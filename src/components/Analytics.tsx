'use client';

import { useEffect } from 'react';

import { identifyMember, startAnalytics } from '@/lib/analytics';

/**
 * Starts analytics once (when a key is configured). Inside the signed-in app it
 * is also given the member's id and says who is browsing; elsewhere (no
 * memberId at all) it leaves whoever is known as they are.
 */
export function Analytics({ memberId, role }: { memberId?: string | null; role?: string | null }) {
  useEffect(() => {
    startAnalytics();
    if (memberId !== undefined) identifyMember(memberId, role);
  }, [memberId, role]);
  return null;
}
