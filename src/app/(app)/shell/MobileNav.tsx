'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Icon } from '@/components/Icon';
import type { IconName } from '@/lib/roles';

type Item = { href: string; label: string; icon: IconName };
type Group = { label: string; items: Item[] };

const isOn = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * The phone's navigation: four tabs at the bottom where a thumb reaches, and
 * "More" — a sheet holding everything the sidebar holds on a larger screen,
 * plus whatever the server passes in (the role switcher, the theme).
 */
export function MobileTabBar({
  tabs,
  groups,
  moreLabel,
  closeLabel,
  unread,
  children,
}: {
  tabs: Item[];
  groups: Group[];
  moreLabel: string;
  closeLabel: string;
  unread: number;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Only the longest matching tab is lit, so /admin does not light up on /admin/payments.
  const active = tabs
    .filter((tab) => isOn(pathname, tab.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <nav className="tabbar" aria-label={moreLabel}>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tabbar-item${active === tab.href ? ' is-active' : ''}`}
            aria-current={active === tab.href ? 'page' : undefined}
          >
            <span className="tabbar-icon">
              <Icon name={tab.icon} size={22} />
              {tab.href === '/messages' && unread > 0 && <span className="tabbar-dot" />}
            </span>
            <span className="tabbar-label">{tab.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`tabbar-item${open || !active ? ' is-active' : ''}`}
          aria-expanded={open}
          aria-controls="more-sheet"
          onClick={() => setOpen(true)}
        >
          <span className="tabbar-icon"><Icon name="more" size={22} /></span>
          <span className="tabbar-label">{moreLabel}</span>
        </button>
      </nav>

      <div
        className="sheet-backdrop"
        hidden={!open}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <div
          id="more-sheet"
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label={moreLabel}
          onClick={(event) => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}
        >
          <div className="sheet-head">
            <span className="sheet-grip" aria-hidden="true" />
            <button type="button" className="icon-button" aria-label={closeLabel} onClick={() => setOpen(false)}>
              <Icon name="close" size={20} />
            </button>
          </div>

          {children && <div className="sheet-extra">{children}</div>}

          {groups.map((group) => (
            <section className="sheet-group" key={group.label}>
              <h2>{group.label}</h2>
              <div className="sheet-grid">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sheet-tile${isOn(pathname, item.href) ? ' is-active' : ''}`}
                  >
                    <span className="sheet-tile-icon"><Icon name={item.icon} size={22} /></span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
