'use client';

import { useEffect, useState } from 'react';

import { Icon } from '@/components/Icon';

/**
 * The menu button a narrow header shows in place of its links.
 *
 * What the menu holds is rendered on the server and passed in, so this only
 * opens and closes it: a tap on any link inside closes it, Escape closes it,
 * and the page behind does not scroll while it is open.
 */
export function SiteMenu({
  openLabel,
  closeLabel,
  children,
}: {
  openLabel: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
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

  return (
    <>
      <button
        type="button"
        className="icon-button site-menu-button"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? 'close' : 'menu'} size={22} />
      </button>

      <div
        id="site-menu"
        className={`site-menu${open ? ' is-open' : ''}`}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a') || event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div className="site-menu-sheet">{children}</div>
      </div>
    </>
  );
}
