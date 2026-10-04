import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { ACTIVE_ROLE_COOKIE, defaultRole } from '@/lib/roles';
import type { UserRole } from '@/lib/database.types';

import { DeviceSetup } from '@/components/DeviceSetup';

import { RoleDashboard } from './RoleDashboard';
import { StudentHome } from './student/StudentHome';
import { BookSessionFab } from '@/components/BookSessionFab';
import { parseLeague } from './student/League';
import { roleInScope } from '@/lib/scope';

export const generateMetadata = localizedTitle('الرئيسية — TechMood', 'Home — TechMood');

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ lm?: string; lw?: string; lp?: string }>;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: roles }, { data: pushKey }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, display_name, techmood_id, avatar_url, primary_role')
      .eq('id', user.id)
      .single(),
    supabase.from('profile_roles').select('role, status').eq('profile_id', user.id),
    // The public half of the VAPID key, for turning notifications on (0100).
    supabase.rpc('push_public_key'),
  ]);

  if (!profile) redirect('/login');

  // Roles outside the MVP (src/lib/scope.ts) are neither shown nor entered.
  const held = (roles ?? []).filter((row) => roleInScope(row.role));
  const approved = held.filter((row) => row.status === 'approved').map((row) => row.role as UserRole);
  const pendingRoles = held.filter((row) => row.status === 'pending_review');

  const jar = await cookies();
  const requested = jar.get(ACTIVE_ROLE_COOKIE)?.value as UserRole | undefined;
  const active = requested && approved.includes(requested)
    ? requested
    : defaultRole(approved, (profile.primary_role ?? null) as UserRole | null);

  const params = await searchParams;
  const league = parseLeague(params);

  return (
    <>
      {pendingRoles.length > 0 && (
        <p className="notice section-block">
          {t(`لديك ${pendingRoles.length} طلب دور قيد المراجعة — تتابع حالته من `,
             `You have ${pendingRoles.length} role ${pendingRoles.length === 1 ? 'request' : 'requests'} under review — follow it in `)}
          <Link href="/settings/roles">{t('أدواري', 'My roles')}</Link>
          {t('. بقية أدوارك تعمل كالمعتاد.', '. Your other roles carry on as normal.')}
        </p>
      )}

      {/* Install + notifications, until both are on for this device. */}
      <DeviceSetup variant="home" publicKey={(pushKey as string | null) ?? null} />

      {/*
        The home page is the workspace of the role you are browsing as. For a
        student that is the command centre below; every other role keeps the
        role dashboard until its own centre is designed.
      */}
      {active === 'student'
        ? <StudentHome userId={user.id} profile={profile} league={league} />
        : <RoleDashboard role={active} userId={user.id} name={profile.display_name ?? profile.full_name} />}
      {/* A learner — a student or a mentee — books a session from here in one tap. */}
      {(active === 'student' || active === 'mentee') && <BookSessionFab />}
    </>
  );
}
