'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { requestToJoin, type JoinState } from '@/app/(app)/teams/join-actions';

/** «اطلب انضمام للفريق» on a project page (0156): a short note, and the leader decides. */
export function JoinTeamBox({ teamId, teamTitle, back }: { teamId: string; teamTitle: string; back: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(requestToJoin, undefined as JoinState);
  const [open, setOpen] = useState(false);

  if (state?.ok) return <p className="notice notice-ok" style={{ fontSize: '0.84rem' }}>{state.ok}</p>;
  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-sm sc-join-btn" onClick={() => setOpen(true)}>
        🙋 {t('اطلب الانضمام للفريق', 'Ask to join the team')}
      </button>
    );
  }
  return (
    <form action={action} className="sc-join-form">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="back" value={back} />
      <label htmlFor="join-message" className="muted" style={{ fontSize: '0.8rem' }}>
        {t(`ماذا تضيف لفريق «${teamTitle}»؟ (اختياري)`, `What would you bring to “${teamTitle}”? (optional)`)}
      </label>
      <textarea id="join-message" name="message" rows={3} maxLength={500}
                placeholder={t('مثال: أعمل على الواجهات بـ React ويمكنني المساعدة في…', 'e.g. I build React interfaces and can help with…')} />
      {state?.error && <p className="notice notice-danger" style={{ fontSize: '0.82rem' }}>{state.error}</p>}
      <div className="row-actions">
        <button className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending}>{t('أرسل الطلب', 'Send request')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</button>
      </div>
    </form>
  );
}
