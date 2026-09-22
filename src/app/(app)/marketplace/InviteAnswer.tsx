'use client';

import { useT } from '@/lib/i18n.client';

import { respondToInvite } from './market-actions';

/** Yes or no to being asked by name. Yes is an application, already shortlisted. */
export function InviteAnswer({ inviteId }: { inviteId: string }) {
  const t = useT();

  return (
    <form action={respondToInvite} className="row-actions">
      <input type="hidden" name="invite_id" value={inviteId} />
      <button className="btn btn-primary btn-sm" name="answer" value="accept">
        {t('أقبل', 'Accept')}
      </button>
      <button className="btn btn-ghost btn-sm" name="answer" value="decline">
        {t('أعتذر', 'Decline')}
      </button>
    </form>
  );
}
