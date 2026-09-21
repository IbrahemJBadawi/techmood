'use client';

import { useActionState } from 'react';

import { inviteMember, type TeamState } from '../../actions';
import { useT } from '@/lib/i18n.client';

/**
 * One account, one TechMood ID: an invitation reaches a person who already
 * exists on the platform. It never creates a second identity for the team.
 */
export function InviteForm({ teamId }: { teamId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(inviteMember, undefined as TeamState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{t('دعوة عضو', 'Invite someone')}</h3>

      <div className="field-row">
        <div className="field">
          <label htmlFor="techmood_id">TechMood ID</label>
          <input id="techmood_id" name="techmood_id" dir="ltr" placeholder="TMU-XXXXXXXX" required />
        </div>
        <div className="field">
          <label htmlFor="responsibility">{t('المسؤولية', 'Responsibility')}</label>
          <input id="responsibility" name="responsibility" placeholder="Frontend, QA, UI/UX…" />
        </div>
      </div>

      <input type="hidden" name="team_id" value={teamId} />

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الدعوة', 'Send invitation')}
      </button>
    </form>
  );
}
