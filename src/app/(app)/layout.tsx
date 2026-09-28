import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { ACTIVE_ROLE_COOKIE, defaultRole, mobileTabsFor, navFor, ROLE_BY_VALUE } from '@/lib/roles';
import type { UiLanguage, UserRole } from '@/lib/database.types';

import { NavLink } from './NavLink';
import { RoleSwitcher } from './RoleSwitcher';
import { HeaderSearch } from './shell/HeaderSearch';
import { Notifications } from './shell/Notifications';
import { ProfileMenu } from './shell/ProfileMenu';
import { ThemeToggle } from './shell/ThemeToggle';
import { Assistant } from './shell/Assistant';
import { AssistantProvider } from './shell/AssistantProvider';
import { LogoMark } from '@/components/Logo';
import { InstallApp } from '@/components/InstallApp';
import { MobileTabBar } from './shell/MobileNav';
import { roleInScope } from '@/lib/scope';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: profile }, { data: roles }, { data: notifications }, { data: restrictions }, { data: mentorApplication },
  ] = await Promise.all([
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
    // A decision about the account is shown on every page until it ends (0084).
    supabase.rpc('my_restrictions'),
    // An open mentor application is shown on every page too, so the applicant
    // always knows where they stand while using TechMood as a learner (0093).
    supabase.rpc('my_mentor_application'),
  ]);

  // An account that has not finished onboarding has no username, no fields and
  // no answered role questions — there is nothing for the shell to render yet.
  if (!profile?.onboarding_completed_at) redirect('/onboarding');

  // Roles outside the MVP (src/lib/scope.ts) are neither shown nor entered.
  const held = (roles ?? []).filter((row) => roleInScope(row.role));
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
  const application = (mentorApplication ?? [])[0];
  const unread = inbox.filter((row) => !row.is_read).length;

  // The phone's tabs and its "More" sheet carry the same places as the sidebar.
  const accountGroup = {
    label: t('الحساب', 'Account'),
    items: [
      { href: '/settings/roles', label: t('أدواري', 'My roles'), icon: 'settings' as const },
      { href: '/guide', label: t('دليل التقييمات', 'Ratings guide'), icon: 'review' as const },
    ],
  };
  const sheetGroups = [
    ...groups.map((group) => ({
      label: t(group.label),
      items: group.items.map((item) => ({ href: item.href, label: t(item.label), icon: item.icon })),
    })),
    accountGroup,
  ];
  const tabs = mobileTabsFor(active).map((item) => ({ href: item.href, label: t(item.label), icon: item.icon }));

  return (
    <div className="app">
      <aside className="sidebar" aria-label={t('التنقّل', 'Navigation')}>
        <div className="sidebar-logo">
          <LogoMark />
          <span className="sidebar-wordmark">TechMood</span>
        </div>
        <p className="sidebar-role" title={t(ROLE_BY_VALUE[active].blurb)}>
          {t('أنت الآن: ', 'You are browsing as: ')}<strong>{t(ROLE_BY_VALUE[active].label)}</strong>
          <span>{t(ROLE_BY_VALUE[active].blurb)}</span>
        </p>

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
          <NavLink href="/guide" icon="review">{t('دليل التقييمات والترقيات', 'Ratings & levels guide')}</NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-inner">
            <Link className="topbar-brand" href="/home" aria-label="TechMood">
              <LogoMark size={28} />
            </Link>
            <HeaderSearch />

            <div className="topbar-actions">
              <Link className="icon-button topbar-search-icon" href="/search"
                    title={t('بحث', 'Search')} aria-label={t('بحث', 'Search')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </Link>
              <span className="topbar-wide"><RoleSwitcher roles={held} active={active} /></span>
              <Link className="icon-button topbar-wide" href="/messages"
                    title={t('الرسائل', 'Messages')} aria-label={t('الرسائل', 'Messages')}>
                <Icon name="message" />
              </Link>
              <Notifications items={inbox} unread={unread} />
              <span className="topbar-wide"><ThemeToggle /></span>
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

        <AssistantProvider>
          <div className="content" data-active-role={ROLE_BY_VALUE[active].value}>
            {(restrictions ?? []).length > 0 && (
              <p className="notice notice-danger" style={{ marginBottom: 16 }}>
                {(restrictions ?? []).some((row) => row.feature === 'everything')
                  ? t('حسابك موقوف بقرار إداري', 'Your account is suspended by an admin decision')
                  : t('بعض الميزات موقوفة على حسابك بقرار إداري', 'Some features are restricted on your account by an admin decision')}
                {': '}{(restrictions ?? []).map((row) => row.reason_ar).join(' · ')}
                {' — '}<Link href="/support">{t('المساعدة والبلاغات', 'Help & reports')}</Link>
              </p>
            )}
            <InstallApp />
            {application && (
              <p className={`notice ${application.status === 'needs_more_info' ? 'notice-warn' : application.status === 'rejected' ? 'notice-danger' : ''}`}
                 style={{ marginBottom: 16 }}>
                {application.status === 'pending_review' && (application.has_details
                  ? t('طلبك كمنتور قيد المراجعة — استخدم المنصة كطالب بكل خدماتها حتى يصلك القرار، وأضف أدلة تقوّي طلبك.',
                      'Your mentor application is under review — use TechMood as a learner, with every service, until the decision arrives, and add evidence to strengthen it.')
                  : t('طلبك كمنتور قيد المراجعة — أكمل الأساسيات (سطر تعريفي، مجال، سنوات خبرة) حتى تستطيع الإدارة البتّ فيه.',
                      'Your mentor application is under review — complete the basics (headline, a field, years of experience) so the team can decide on it.'))}
                {application.status === 'needs_more_info' &&
                  t('الإدارة طلبت معلومات إضافية لطلبك كمنتور', 'The team asked for more information on your mentor application')}
                {application.status === 'rejected' &&
                  t('لم يُقبل طلبك كمنتور، وتبقى طالباً بكل خدماتك', 'Your mentor application was not accepted; you remain a learner with every service')}
                {application.review_note && application.status !== 'pending_review' ? `: ${application.review_note}` : ''}
                {' — '}<Link href="/settings/roles/mentor">{t('طلبي', 'My application')}</Link>
              </p>
            )}
            {children}
          </div>

          {/* A layer over every page, not a page of its own. */}
          <Assistant />
        </AssistantProvider>
      </div>

      <MobileTabBar
        tabs={tabs}
        groups={sheetGroups}
        moreLabel={t('المزيد', 'More')}
        closeLabel={t('إغلاق', 'Close')}
        unread={0}
      >
        <div className="sheet-role">
          <span className="muted">{t('تتصفّح بدور', 'Browsing as')}</span>
          <RoleSwitcher roles={held} active={active} />
          <ThemeToggle />
        </div>
      </MobileTabBar>
    </div>
  );
}
