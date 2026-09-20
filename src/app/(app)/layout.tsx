import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ACTIVE_ROLE_COOKIE, defaultRole, navFor, ROLE_BY_VALUE } from '@/lib/roles';
import type { UserRole } from '@/lib/database.types';

import { signOut } from '../(auth)/actions';
import { NavLink } from './NavLink';
import { RoleSwitcher } from './RoleSwitcher';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, display_name, techmood_id, avatar_url, primary_role, onboarding_completed_at')
      .eq('id', user.id)
      .single(),
    supabase.from('profile_roles').select('role, status').eq('profile_id', user.id),
  ]);

  // An account that has not finished onboarding has no username, no fields and
  // no answered role questions — there is nothing for the shell to render yet.
  if (!profile?.onboarding_completed_at) redirect('/onboarding');

  const held = roles ?? [];
  const approved = held.filter((row) => row.status === 'approved').map((row) => row.role);

  // The cookie is a preference, not a permission: whatever it says, the role is
  // only honoured when it is one of the approved ones.
  const jar = await cookies();
  const requested = jar.get(ACTIVE_ROLE_COOKIE)?.value as UserRole | undefined;
  const active = requested && approved.includes(requested)
    ? requested
    : defaultRole(approved, profile.primary_role);

  const groups = navFor(active);
  const displayName = profile.display_name ?? profile.full_name;

  return (
    <div className="app">
      <aside className="sidebar" aria-label="التنقّل">
        <div className="sidebar-logo">
          <span className="logo-mark" />
          <span className="sidebar-wordmark">TechMood</span>
        </div>

        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink href={item.href} icon={item.icon} key={item.href}>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="nav-group">
          <div className="nav-group-label">الحساب</div>
          <NavLink href="/settings/roles" icon="settings">أدواري</NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-inner">
            <h1>{displayName}</h1>
            <div className="topbar-actions">
              <RoleSwitcher roles={held} active={active} />
              <span className="id-chip">{profile.techmood_id}</span>
              <Link className="btn btn-ghost btn-sm" href="/passport">ملفي</Link>
              <form action={signOut}>
                <button className="btn btn-ghost btn-sm" type="submit">خروج</button>
              </form>
            </div>
          </div>
        </header>

        <div className="content" data-active-role={ROLE_BY_VALUE[active].value}>
          {children}
        </div>
      </div>
    </div>
  );
}
