'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { inviteToOpportunity, type MarketState } from '../market-actions';

/**
 * Asking one person by name. The database checks both halves of that: that
 * this is the poster's own opening, and that the person ever offered their
 * work in the first place.
 */
export function InviteRow({
  opportunityId,
  profileId,
  name,
  headline,
  alreadyInvited,
}: {
  opportunityId: string;
  profileId: string;
  name: string;
  headline: string | null;
  alreadyInvited: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(inviteToOpportunity, undefined as MarketState);

  return (
    <form action={formAction} className="panel session-row">
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <input type="hidden" name="profile_id" value={profileId} />

      <div style={{ minWidth: 0 }}>
        <strong style={{ fontSize: '0.9rem' }}>{name}</strong>
        {headline && <p className="muted" style={{ fontSize: '0.78rem' }}>{headline}</p>}
        {state?.error && <p className="notice notice-danger" style={{ marginTop: 6 }}>{state.error}</p>}
        {state?.ok && <p className="notice notice-ok" style={{ marginTop: 6 }}>{state.ok}</p>}
      </div>

      <div className="session-row-actions">
        <input
          name="message"
          placeholder={t('رسالة قصيرة (اختياري)', 'A short message (optional)')}
          aria-label={t('رسالة الدعوة', 'Invitation message')}
          className="invite-message"
        />
        <button className="btn btn-ghost btn-sm" disabled={pending || alreadyInvited || Boolean(state?.ok)}>
          {alreadyInvited || state?.ok ? t('مدعوّ', 'Invited') : t('ادعُه', 'Invite')}
        </button>
      </div>
    </form>
  );
}
