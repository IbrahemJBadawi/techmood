import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { NOTIFICATION_KIND, NOTIFICATION_ORDER, PRIORITY } from '@/lib/notifications';
import type { NotificationKind } from '@/lib/database.types';

import { markNotificationsRead } from '../shell/actions';

export const metadata = { title: 'Notifications — TechMood' };

/**
 * Everything the platform has told this person.
 *
 * A notification is an event, not a conversation — the difference from Messages
 * is deliberate and kept: "Ahmed asked to move the session" is a message, "your
 * session moved to 7pm" is this. Each one knows what it is about, so it opens
 * the thing itself rather than a page somebody has to search from.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; unread?: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const kind = NOTIFICATION_ORDER.includes(params.kind as NotificationKind)
    ? (params.kind as NotificationKind)
    : undefined;
  const unreadOnly = params.unread === '1';

  const [{ data: items }, { data: counts }] = await Promise.all([
    supabase.rpc('my_notifications', {
      p_kind: kind ?? null,
      p_unread: unreadOnly,
      p_limit: 100,
    }),
    supabase.rpc('notification_counts'),
  ]);

  const countOf = new Map((counts ?? []).map((row) => [row.kind, row]));
  const totalUnread = (counts ?? []).reduce((sum, row) => sum + row.unread, 0);

  const href = (next: { kind?: string; unread?: string }) => {
    const query = new URLSearchParams();
    const merged = { kind, unread: unreadOnly ? '1' : undefined, ...next };
    for (const [key, value] of Object.entries(merged)) if (value) query.set(key, String(value));
    return `/notifications?${query.toString()}`;
  };

  // Today, yesterday, and everything before — the way a person reads a feed.
  const today = new Date().toDateString();
  const yesterday = new Date(new Date().getTime() - 86400000).toDateString();
  const dayOf = (iso: string) => {
    const day = new Date(iso).toDateString();
    if (day === today) return t('اليوم', 'Today');
    if (day === yesterday) return t('أمس', 'Yesterday');
    return formatDateTime(locale, iso).split('،')[0];
  };

  const groups: { label: string; rows: NonNullable<typeof items> }[] = [];
  for (const item of items ?? []) {
    const label = dayOf(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(item);
    else groups.push({ label, rows: [item] });
  }

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>{t('الإشعارات', 'Notifications')}</h2>
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '64ch' }}>
              {t('كل ما أخبرتك به المنصة، وكل إشعار يفتح الشيء نفسه لا صفحة عامة. المحادثات في «الرسائل» — هنا الأحداث.',
                 'Everything the platform has told you, and each one opens the thing itself rather than a general page. Conversations live in Messages — events live here.')}
            </p>
          </div>

          <div className="row-actions">
            <Link className="btn btn-ghost btn-sm" href="/settings/notifications">
              {t('إعدادات الإشعارات', 'Notification settings')}
            </Link>
            {totalUnread > 0 && (
              <form action={markNotificationsRead}>
                <button className="btn btn-primary btn-sm">{t('تعليم الكل كمقروء', 'Mark all as read')}</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="filter-row">
          <Link className={`chip${!kind ? ' is-active' : ''}`} href={href({ kind: '' })}>
            {t('الكل', 'All')}
          </Link>
          <Link className={`chip${unreadOnly ? ' is-active' : ''}`} href={href({ unread: unreadOnly ? '' : '1' })}>
            {t('غير المقروء', 'Unread')}
            {totalUnread > 0 && <span className="eng"> {totalUnread}</span>}
          </Link>
          {NOTIFICATION_ORDER.map((option) => {
            const count = countOf.get(option);
            if (!count || count.total === 0) return null;

            return (
              <Link className={`chip${kind === option ? ' is-active' : ''}`} href={href({ kind: option })} key={option}>
                {NOTIFICATION_KIND[option].icon} {t(NOTIFICATION_KIND[option].label)}
                {count.unread > 0 && <span className="eng"> {count.unread}</span>}
              </Link>
            );
          })}
        </div>
      </section>

      {(items ?? []).length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا شيء هنا', 'Nothing here')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('جرّب فلتراً آخر، أو عد لاحقاً.', 'Try another filter, or come back later.')}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section className="section-block" key={group.label}>
            <h3 className="academy-heading">{group.label}</h3>
            <div className="stack">
              {group.rows.map((item) => (
                <article className={`panel notification-row${item.is_read ? '' : ' is-unread'}`} key={item.id}>
                  <span className="notification-icon" aria-hidden="true">
                    {NOTIFICATION_KIND[item.kind].icon}
                  </span>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row-between" style={{ gap: 10 }}>
                      <strong style={{ fontSize: '0.94rem' }}>{item.title_ar}</strong>
                      {item.priority !== 'normal' && (
                        <span className={`status-pill ${PRIORITY[item.priority].className}`}>
                          {t(PRIORITY[item.priority].label)}
                        </span>
                      )}
                    </div>
                    {item.body_ar && (
                      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>{item.body_ar}</p>
                    )}
                    <p className="muted" style={{ fontSize: '0.76rem', marginTop: 4 }}>
                      {t(NOTIFICATION_KIND[item.kind].label)} · {formatDateTime(locale, item.created_at)}
                    </p>
                  </div>

                  {item.link && (
                    <Link className="btn btn-ghost btn-sm" href={item.link}>{t('افتح', 'Open')}</Link>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
