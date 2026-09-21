'use client';

import { useState } from 'react';

import { Icon } from '@/components/Icon';
import { useT } from '@/lib/i18n.client';
import { ROLE_BY_VALUE, ROLE_STATUS_LABEL, roleLabel } from '@/lib/roles';
import type { RoleStatus, UserRole } from '@/lib/database.types';

import { switchRole } from './actions';

export type SwitchableRole = { role: UserRole; status: RoleStatus };

/**
 * Pending, rejected and suspended roles are listed here on purpose: hiding them
 * would leave the person guessing what happened to a request. They are listed
 * as what they are — not enterable — and the server refuses them anyway.
 */
export function RoleSwitcher({ roles, active }: { roles: SwitchableRole[]; active: UserRole }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="role-switcher">
      <button
        type="button"
        className="role-switcher-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={ROLE_BY_VALUE[active].icon} />
        <span>{t(roleLabel(active))}</span>
        <span aria-hidden="true" className="chevron">⌄</span>
      </button>

      {open && (
        <div className="role-switcher-menu" role="menu">
          <p className="role-switcher-hint">
            {t('الأدوار ليست ترتيباً — كل دور يفتح مساحة مختلفة.',
               'Roles are not a ranking — each one opens a different space.')}
          </p>

          {roles.map(({ role, status }) => {
            const enterable = status === 'approved';
            return (
              <form action={switchRole} key={role}>
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  role="menuitem"
                  className={`role-switcher-item${role === active ? ' is-active' : ''}`}
                  disabled={!enterable}
                  title={enterable ? undefined : t('هذا الدور غير معتمد بعد', 'This role is not approved yet')}
                >
                  <Icon name={ROLE_BY_VALUE[role].icon} />
                  <span className="role-switcher-label">{t(roleLabel(role))}</span>
                  {!enterable && (
                    <span className="pill pill-wait">{t(ROLE_STATUS_LABEL[status])}</span>
                  )}
                </button>
              </form>
            );
          })}

          <a className="role-switcher-foot" href="/settings/roles">
            {t('إدارة أدواري', 'Manage my roles')}
          </a>
        </div>
      )}
    </div>
  );
}
