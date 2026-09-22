import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { ACTIVE_ROLE_COOKIE, defaultRole, navFor, ROLE_BY_VALUE } from '@/lib/roles';
import type { UiLanguage, UserRole } from '@/lib/database.types';

import { NavLink } from './NavLink';
import { RoleSwitcher } from './RoleSwitcher';
import { HeaderSearch } from './shell/HeaderSearch';
import { Notifications } from './shell/Notifications';
import { ProfileMenu } from './shell/ProfileMenu';
import { ThemeToggle } from './shell/ThemeToggle';
import { LogoMark } from '@/components/Logo';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: roles }, { data: notifications }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, display_name, username, techmood_id, avatar_url, language, primary_role, onboarding_completed_at')
      .eq('id', user.id)
      .single(),
    supabase.from('profile_roles').select('role, status').eq('profile_id', user.id),
    supabase
      .from('notifications')
      .select('id, kind, title_ar, body_ar, link, is_read, created_at, priority')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12),
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
  const inbox = notifications ?? [];
  const unread = inbox.filter((row) => !row.is_read).length;

  return (
    <div className="app">
      <aside className="sidebar" aria-label={t('التنقّل', 'Navigation')}>
        <div className="sidebar-logo">
          <LogoMark />
          <span className="sidebar-wordmark">TechMood</span>
        </div>

        {groups.map((group) => (
          <div className="nav-group" key={group.label.en}>
            <div className="nav-group-label">{t(group.label)}</div>
            {group.items.map((item) => (
              <NavLink href={item.href} icon={item.icon} key={item.href}>
                {t(item.label)}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="nav-group">
          <div className="nav-group-label">{t('الحساب', 'Account')}</div>
          <NavLink href="/settings/roles" icon="settings">{t('أدواري', 'My roles')}</NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-inner">
            <HeaderSearch />

            <div className="topbar-actions">
              <RoleSwitcher roles={held} active={active} />
              <Link className="icon-button" href="/messages"
                    title={t('الرسائل', 'Messages')} aria-label={t('الرسائل', 'Messages')}>
                <Icon name="message" />
              </Link>
              <Notifications items={inbox} unread={unread} />
              <ThemeToggle />
              <ProfileMenu
                name={displayName}
                techmoodId={profile.techmood_id}
                username={profile.username}
                avatarUrl={profile.avatar_url}
                language={profile.language as UiLanguage}
              />
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
