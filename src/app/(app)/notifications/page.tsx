import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT, localizedTitle } from '@/lib/i18n.server';
import { formatDate, intlTag } from '@/lib/i18n';
import { Icon } from '@/components/Icon';
import { NOTIFICATION_KIND, NOTIFICATION_ORDER, PRIORITY, kindLook } from '@/lib/notifications';
import type { NotificationKind } from '@/lib/database.types';

import { LiveRefresh } from '@/components/LiveRefresh';
import { LongPressMenu } from '@/components/LongPressMenu';

import { markNotificationRead, markNotificationsRead } from '../shell/actions';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

export const generateMetadata = localizedTitle('الإشعارات — TechMood', 'Notifications — TechMood');

const KIND_COLOR: Partial<Record<NotificationKind, string>> = {
  academy: '#2F6BFF', evaluation: '#7C5CFF', booking: '#0B8FB3', team: '#0E9F6E',
  work: '#E8590C', project: '#C77700', message: '#2F6BFF', certificate: '#0E9F6E',
  payment: '#16A36A', role_review: '#7C5CFF', security: '#D6336C', system: '#E8590C', support: '#0B8FB3',
};

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
    return formatDate(locale, iso);
  };
  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat(intlTag(locale), { timeZone: PLATFORM_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  const renderedAt = new Date().toISOString();
  const groups: { label: string; rows: NonNullable<typeof items> }[] = [];
  for (const item of items ?? []) {
    const label = dayOf(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(item);
    else groups.push({ label, rows: [item] });
  }

  return (
    <div className="nt-page">
      <LiveRefresh scope="notifications" since={items?.[0]?.created_at ?? renderedAt} />
      <section className="nt-head section-block">
        <div>
          <h2>
            {t('الإشعارات', 'Notifications')}
            {totalUnread > 0 && <span className="nt-badge">{totalUnread}</span>}
          </h2>
          <p className="muted">
            {t('كل إشعار يفتح الشيء نفسه. المحادثات في «الرسائل» — هنا الأحداث.',
               'Each one opens the thing itself. Conversations live in Messages — events live here.')}
          </p>
        </div>
        <div className="nt-actions">
          {totalUnread > 0 && (
            <form action={markNotificationsRead}>
              <button className="btn btn-ghost btn-sm"><Icon name="check" size={14} /> {t('تعليم الكل كمقروء', 'Mark all read')}</button>
            </form>
          )}
          <Link className="nt-gear" href="/settings/notifications" aria-label={t('إعدادات الإشعارات', 'Notification settings')}
                title={t('إعدادات الإشعارات', 'Notification settings')}>
            <Icon name="settings" size={18} />
          </Link>
        </div>
      </section>

      <nav className="nt-filters section-block" aria-label={t('تصفية', 'Filter')}>
        <Link className={`nt-chip${!kind && !unreadOnly ? ' is-on' : ''}`} href="/notifications">
          {t('الكل', 'All')}
        </Link>
        <Link className={`nt-chip${unreadOnly ? ' is-on' : ''}`} href={href({ unread: unreadOnly ? '' : '1' })}>
          {t('غير المقروء', 'Unread')}
          {totalUnread > 0 && <span className="nt-chip-count">{totalUnread}</span>}
        </Link>
        {NOTIFICATION_ORDER.map((option) => {
          const count = countOf.get(option);
          if (!count || count.total === 0) return null;
          return (
            <Link className={`nt-chip${kind === option ? ' is-on' : ''}`} href={href({ kind: kind === option ? '' : option })} key={option}>
              <span aria-hidden="true">{NOTIFICATION_KIND[option].icon}</span> {t(NOTIFICATION_KIND[option].label)}
              {count.unread > 0 && <span className="nt-chip-count">{count.unread}</span>}
            </Link>
          );
        })}
      </nav>

      {(items ?? []).length === 0 ? (
        <div className="hm-card nt-empty">
          <span aria-hidden="true">🔔</span>
          <h3>{unreadOnly ? t('قرأت كل شيء', 'All caught up') : t('لا شيء هنا', 'Nothing here')}</h3>
          <p className="muted">
            {unreadOnly
              ? t('لا إشعارات غير مقروءة.', 'No unread notifications.')
              : t('جرّب فلتراً آخر، أو عد لاحقاً.', 'Try another filter, or come back later.')}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section className="section-block" key={group.label}>
            <h3 className="nt-day">{group.label}</h3>
            <ul className="nt-list">
              {group.rows.map((item) => {
                const look = kindLook(item.kind);
                const body = (
                  <>
                    <span className="nt-icon" style={{ background: `color-mix(in srgb, ${KIND_COLOR[item.kind] ?? '#5B6B7C'} 14%, transparent)` }} aria-hidden="true">
                      {look.icon}
                    </span>
                    <span className="nt-main">
                      <span className="nt-title">
                        <strong>{item.title_ar}</strong>
                        {item.priority === 'critical' || item.priority === 'important' ? (
                          <span className={`status-pill ${PRIORITY[item.priority].className}`}>{t(PRIORITY[item.priority].label)}</span>
                        ) : null}
                      </span>
                      {item.body_ar && <span className="nt-body">{item.body_ar}</span>}
                      <span className="nt-meta">{t(look.label)} · {timeOf(item.created_at)}</span>
                    </span>
                    {!item.is_read && <span className="nt-dot" role="img" aria-label={t('غير مقروء', 'Unread')} />}
                  </>
                );
                return (
                  <li key={item.id} className={item.is_read ? undefined : 'is-unread'}>
                    {/* hold the row for its actions (design lab 3: «ضغط مطوّل») */}
                    <LongPressMenu
                      label={item.title_ar}
                      menu={(
                        <>
                          {item.link && <Link className="lp-action" href={item.link}>{t('افتح', 'Open')}</Link>}
                          {!item.is_read && (
                            <form action={markNotificationRead}>
                              <input type="hidden" name="notification_id" value={item.id} />
                              <button className="lp-action" type="submit">{t('علّمه كمقروء', 'Mark as read')}</button>
                            </form>
                          )}
                          <Link className="lp-action" href={href({ kind: item.kind })}>
                            {t(`كل إشعارات «${t(look.label)}»`, `All “${t(look.label)}” notifications`)}
                          </Link>
                          <Link className="lp-action" href="/settings/notifications">{t('إعدادات الإشعارات', 'Notification settings')}</Link>
                        </>
                      )}
                    >
                      {item.link
                        ? <Link className="nt-row" href={item.link}>{body}</Link>
                        : <div className="nt-row">{body}</div>}
                    </LongPressMenu>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
