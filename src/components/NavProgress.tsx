'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * A thin bar at the top the moment a link is tapped, until the next page is
 * there — so on a slow connection a tap is answered at once instead of the
 * screen sitting still. Only same-site links that open in this tab start it.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState('busy');
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // The new page is here: finish the bar, then hide it.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const finish = setTimeout(() => {
      setState((current) => (current === 'busy' ? 'done' : current));
      timer.current = setTimeout(() => setState('idle'), 300);
    }, 0);
    return () => clearTimeout(finish);
  }, [pathname, search]);

  return <div className={`nav-progress is-${state}`} aria-hidden="true" />;
}
