'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { useT } from '@/lib/i18n.client';

import { SETTINGS_PAGES } from './settings-pages';

/**
 * The settings sections, beside the page on a wide screen and as a row of
 * pills above it on a phone. On the settings home itself a phone shows the
 * list instead, so the pills would only repeat it.
 */
export function SettingsNav() {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav className={`st-nav${pathname === '/settings' ? ' is-home' : ''}`} aria-label={t('أقسام الإعدادات', 'Settings sections')}>
      <Link className={`st-nav-item st-nav-home${pathname === '/settings' ? ' is-on' : ''}`} href="/settings">
        <Icon name="settings" size={18} />
        <span>{t('الإعدادات', 'Settings')}</span>
      </Link>
      {SETTINGS_PAGES.map((page) => {
        const on = pathname === page.href || pathname.startsWith(`${page.href}/`);
        return (
          <Link className={`st-nav-item${on ? ' is-on' : ''}`} href={page.href} key={page.href} aria-current={on ? 'page' : undefined}>
            <span className="st-nav-icon" style={{ background: page.color }}><Icon name={page.icon} size={15} /></span>
            <span>{t(page.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
