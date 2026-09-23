'use client';

import { useActionState, useState } from 'react';

import { useT } from '@/lib/i18n.client';

import { saveProjectSplit, type MoneyState } from './money-actions';

export type SplitRow = {
  profile_id: string;
  full_name: string;
  tasks_done: number;
  suggested: number;
  agreed: number | null;
};

/**
 * How a team's money is shared. The suggestion comes from the board — the
 * tasks each member actually finished on this project — and the lead adjusts
 * it. Every member sees the result; once money is released against it, it no
 * longer moves.
 */
export function TeamSplit({ projectId, rows, canEdit, locked }: {
  projectId: string;
  rows: SplitRow[];
  canEdit: boolean;
  locked: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveProjectSplit, undefined as MoneyState);
  const hasAgreement = rows.some((row) => row.agreed !== null);
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(rows.map((row) => [row.profile_id, row.agreed ?? row.suggested])),
  );
  const total = Object.values(values).reduce((sum, value) => sum + (Number(value) || 0), 0);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('تقسيم مستحقات الفريق', 'How the team is paid')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        {hasAgreement
          ? t('هذا ما اتُّفق عليه، ويراه كل عضو.', 'This is what was agreed, and every member can see it.')
          : t('مقترح من المهام التي أنهاها كل عضو على لوحة المشروع — لم يُعتمد بعد.',
              'Suggested from the tasks each member finished on this project’s board — not agreed yet.')}
        {locked && t(' ثابت: أُفرج عن مبلغ على أساسه.', ' Fixed: money has been released against it.')}
      </p>

      <input type="hidden" name="project_id" value={projectId} />

      <table className="data" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>{t('العضو', 'Member')}</th>
            <th>{t('مهام منجزة', 'Tasks done')}</th>
            <th>{t('النسبة', 'Share')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.profile_id}>
              <td>{row.full_name}<input type="hidden" name="profile_id" value={row.profile_id} /></td>
              <td className="eng">{row.tasks_done}</td>
              <td className="eng">
                {canEdit && !locked ? (
                  <input type="number" min={0} max={100} step="0.01" name={`percent_${row.profile_id}`}
                         value={values[row.profile_id] ?? 0} style={{ width: 90 }}
                         onChange={(event) => setValues({ ...values, [row.profile_id]: Number(event.target.value) })} />
                ) : (
                  `${row.agreed ?? row.suggested}%`
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {canEdit && !locked && (
        <>
          <p className={`eng ${Math.abs(total - 100) < 0.001 ? 'muted' : 'notice notice-danger'}`}
             style={{ fontSize: '0.8rem', marginTop: 8 }}>
            {t('المجموع: ', 'Total: ')}{total.toFixed(2)}%
          </p>
          {state?.error && <p className="notice notice-danger">{state.error}</p>}
          {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
          <button className="btn btn-primary btn-sm" disabled={pending || Math.abs(total - 100) >= 0.001}>
            {t('اعتمد التقسيم', 'Agree the split')}
          </button>
        </>
      )}
    </form>
  );
}
