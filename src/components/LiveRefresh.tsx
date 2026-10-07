'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { newSince } from '@/app/(app)/shell/actions';
import { useT } from '@/lib/i18n.client';

/**
 * Keeps a list fresh without reloading under the reader (design lab 3:
 * «تحديث تلقائي + ↑ جديد»). Every 25 seconds, while the tab is in view, it
 * asks whether anything arrived after the newest item shown. At the top of
 * the notifications, with nothing being typed, it simply refreshes; otherwise
 * a pill says how many are new, and a tap brings them in.
 */
export function LiveRefresh({ scope, since }: { scope: 'notifications' | 'messages'; since: string }) {
  const t = useT();
  const router = useRouter();
  const [fresh, setFresh] = useState(0);
  const [seenSince, setSeenSince] = useState(since);
  const busy = useRef(false);

  // a refreshed page brings a newer `since`: the pill has done its job
  if (since !== seenSince) {
    setSeenSince(since);
    setFresh(0);
  }

  useEffect(() => {
    const check = async () => {
      if (document.hidden || busy.current) return;
      busy.current = true;
      try {
        const count = await newSince(scope, since);
        if (count <= 0) return;
        const active = document.activeElement;
        const typing = active instanceof HTMLTextAreaElement
          || (active instanceof HTMLInputElement && active.value !== '');
        const atTop = scope === 'notifications' && window.scrollY < 80;
        if (atTop && !typing) router.refresh();
        else setFresh(count);
      } catch {
        // offline or signed out: try again next time
      } finally {
        busy.current = false;
      }
    };
    const timer = setInterval(check, 25_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [scope, since, router]);

  if (!fresh) return null;
  return (
    <button
      type="button"
      className={`live-pill is-${scope}`}
      onClick={() => {
        if (scope === 'notifications') window.scrollTo({ top: 0, behavior: 'smooth' });
        router.refresh();
      }}
    >
      {scope === 'notifications'
        ? t(`↑ ${fresh} ${fresh === 1 ? 'إشعار جديد' : 'جديدة'}`, `↑ ${fresh} new`)
        : t(`↓ ${fresh} ${fresh === 1 ? 'رسالة جديدة' : 'رسائل جديدة'}`, `↓ ${fresh} new ${fresh === 1 ? 'message' : 'messages'}`)}
    </button>
  );
}
