'use client';

import { useActionState, useState } from 'react';

import { removeMember, transferLeadership, updateMember, type SettingsState } from './actions';
import { useT } from '@/lib/i18n.client';

type Member = {
  profileId: string;
  role: string;
  responsibility: string | null;
  name: string;
  techmoodId: string;
};

export function MembersAdmin({
  teamId,
  leaderId,
  members,
}: {
  teamId: string;
  leaderId: string;
  members: Member[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(transferLeadership, undefined as SettingsState);
  const [transferTo, setTransferTo] = useState<string | null>(null);

  const others = members.filter((member) => member.profileId !== leaderId);

  return (
    <section className="panel section-block">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('الأعضاء', 'Members')}</h3>

      <table className="data">
        <thead>
          <tr><th>{t('العضو', 'Member')}</th><th>{t('المسؤولية', 'Responsibility')}</th><th></th></tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.profileId}>
              <td>
                {member.name}
                {member.profileId === leaderId && <span className="badge-pill" style={{ marginInlineStart: 8 }}>{t('قائد', 'Lead')}</span>}
                <br />
                <span className="id-chip">{member.techmoodId}</span>
              </td>
              <td>
                <form action={updateMember} style={{ display: 'flex', gap: 6 }}>
                  <input type="hidden" name="team_id" value={teamId} />
                  <input type="hidden" name="profile_id" value={member.profileId} />
                  <input
                    name="responsibility"
                    defaultValue={member.responsibility ?? ''}
                    placeholder="Frontend, QA…"
                    style={{ flex: 1, minWidth: 0, fontSize: '0.8rem' }}
                  />
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.74rem' }}>{t('حفظ', 'Save')}</button>
                </form>
              </td>
              <td>
                {member.profileId !== leaderId && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.74rem' }}
                      onClick={() => setTransferTo(member.profileId)}
                    >
                      {t('اجعله قائداً', 'Make them the lead')}
                    </button>
                    <form action={removeMember}>
                      <input type="hidden" name="team_id" value={teamId} />
                      <input type="hidden" name="profile_id" value={member.profileId} />
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.74rem', color: 'var(--danger)' }}>
                        {t('إزالة', 'Remove')}
                      </button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {others.length === 0 && (
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 12 }}>
          {t('لا يمكن نقل القيادة حتى ينضم عضو آخر للفريق.', 'Leadership cannot be handed over until somebody else joins the team.')}
        </p>
      )}

      {transferTo && (
        <form action={formAction} className="panel" style={{ marginTop: 16 }}>
          <input type="hidden" name="team_id" value={teamId} />
          <input type="hidden" name="profile_id" value={transferTo} />

          <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
            {t('ستنقل قيادة الفريق إلى ', 'Leadership will pass to ')}
            <strong>{members.find((member) => member.profileId === transferTo)?.name}</strong>
            {t('، وتصبح أنت عضواً عادياً. لا يمكنك التراجع إلا إذا أعادها لك القائد الجديد.',
               ', and you become an ordinary member. You cannot undo this unless the new lead hands it back.')}
          </p>

          <div className="field">
            <label htmlFor="confirm">{t('اكتب «نعم» للتأكيد', 'Type “yes” to confirm')}</label>
            <input id="confirm" name="confirm" required />
          </div>

          {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
          {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? t('جارٍ النقل…', 'Transferring…') : t('انقل القيادة', 'Transfer leadership')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTransferTo(null)}>{t('إلغاء', 'Cancel')}</button>
          </div>
        </form>
      )}
    </section>
  );
}
