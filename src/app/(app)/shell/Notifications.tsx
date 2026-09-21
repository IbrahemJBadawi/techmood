'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { formatDate } from '@/lib/i18n';

import { markNotificationsRead } from './actions';

export type NotificationRow = {
  id: string;
  kind: string;
  title_ar: string;
  body_ar: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

/**
 * The notifications table and notify() have existed since the messaging
 * migration; nothing rendered them until now, so every "we told the applicant"
 * in the role review was a row nobody could read. This is that reader.
 *
 * The notification text itself is written by the database in Arabic and is not
 * translated here: it often quotes a person's own words back to them.
 */
export function Notifications({ items, unread }: { items: NotificationRow[]; unread: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="header-menu">
      <button
        type="button"
        className="icon-button"
        aria-expanded={open}
        aria-label={unread > 0
          ? t(`الإشعارات — ${unread} غير مقروء`, `Notifications — ${unread} unread`)
          : t('الإشعارات', 'Notifications')}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell />
        {unread > 0 && <span className="dot-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="header-dropdown" role="menu">
          <div className="header-dropdown-head">
            <strong>{t('الإشعارات', 'Notifications')}</strong>
            {unread > 0 && (
              <form action={markNotificationsRead}>
                <button className="link-button" type="submit">
                  {t('تعليم الكل كمقروء', 'Mark all as read')}
                </button>
              </form>
            )}
          </div>

          {items.length === 0 && (
            <p className="header-dropdown-empty">{t('لا إشعارات بعد.', 'Nothing yet.')}</p>
          )}

          <ul className="notification-list">
            {items.map((item) => {
              const body = (
                <>
                  <strong dir="rtl">{item.title_ar}</strong>
                  {item.body_ar && <span className="muted" dir="rtl">{item.body_ar}</span>}
                  <time dateTime={item.created_at}>{formatDate(t.locale, item.created_at)}</time>
                </>
              );
              return (
                <li key={item.id} className={item.is_read ? '' : 'is-unread'}>
                  {item.link
                    ? <Link href={item.link} onClick={() => setOpen(false)}>{body}</Link>
                    : <span>{body}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Bell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9zM13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
