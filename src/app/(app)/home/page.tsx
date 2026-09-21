import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ACTIVE_ROLE_COOKIE, defaultRole } from '@/lib/roles';
import type { UserRole } from '@/lib/database.types';

import { RoleDashboard } from './RoleDashboard';
import { StudentHome } from './student/StudentHome';
import type { WindowKey } from './student/Leaderboard';

export const metadata = { title: 'الرئيسية — TechMood' };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ lb?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, display_name, techmood_id, avatar_url, primary_role')
      .eq('id', user.id)
      .single(),
    supabase.from('profile_roles').select('role, status').eq('profile_id', user.id),
  ]);

  if (!profile) redirect('/login');

  const held = roles ?? [];
  const approved = held.filter((row) => row.status === 'approved').map((row) => row.role as UserRole);
  const pendingRoles = held.filter((row) => row.status === 'pending_review');

  const jar = await cookies();
  const requested = jar.get(ACTIVE_ROLE_COOKIE)?.value as UserRole | undefined;
  const active = requested && approved.includes(requested)
    ? requested
    : defaultRole(approved, (profile.primary_role ?? null) as UserRole | null);

  const params = await searchParams;
  const windowKey: WindowKey =
    params.lb === 'month' || params.lb === 'year' ? params.lb : 'all';

  return (
    <>
      {pendingRoles.length > 0 && (
        <p className="notice section-block">
          لديك {pendingRoles.length} طلب دور قيد المراجعة — تتابع حالته من{' '}
          <Link href="/settings/roles">أدواري</Link>. بقية أدوارك تعمل كالمعتاد.
        </p>
      )}

      {/*
        The home page is the workspace of the role you are browsing as. For a
        student that is the command centre below; every other role keeps the
        role dashboard until its own centre is designed.
      */}
      {active === 'student'
        ? <StudentHome userId={user.id} profile={profile} windowKey={windowKey} />
        : <RoleDashboard role={active} userId={user.id} />}
    </>
  );
}
