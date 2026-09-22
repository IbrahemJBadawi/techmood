'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { MEMBER_ROLE } from '@/lib/incubator';
import type { StartupMemberRole } from '@/lib/database.types';

import { addMember, type TeamState } from './actions';

const ROLES = Object.keys(MEMBER_ROLE) as StartupMemberRole[];

export function MemberForm({ startupId }: { startupId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(addMember, undefined as TeamState);

  return (
    <form action={formAction} className="panel meeting-form">
      <input type="hidden" name="startup_id" value={startupId} />

      <div className="field">
        <label htmlFor="techmood_id">{t('معرّف TechMood', 'TechMood ID')}</label>
        <input id="techmood_id" name="techmood_id" dir="ltr" placeholder="TM-XXXXXX" required />
      </div>
      <div className="field">
        <label htmlFor="role">{t('الدور', 'Role')}</label>
        <select id="role" name="role" defaultValue="member">
          {ROLES.filter((role) => role !== 'founder').map((role) => (
            <option key={role} value={role}>{t(MEMBER_ROLE[role].label)}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="title">{t('المسمّى', 'Title')}</label>
        <input id="title" name="title" />
      </div>

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Adding…') : t('أضف', 'Add')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
