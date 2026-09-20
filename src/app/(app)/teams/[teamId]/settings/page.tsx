import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { TeamNav } from '../TeamNav';
import { SettingsForm } from './SettingsForm';
import { PermissionsForm } from './PermissionsForm';
import { MembersAdmin } from './MembersAdmin';
import type { Team } from '@/lib/database.types';

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  if (team.leader_id !== user.id) {
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (isAdmin !== true) {
      return (
        <>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>→ رجوع</Link>
          <p className="notice notice-danger" style={{ marginTop: 16 }}>
            إعدادات الفريق لقائد الفريق فقط.
          </p>
        </>
      );
    }
  }

  const [{ data: permissions }, { data: members }] = await Promise.all([
    supabase.from('team_permissions').select('*').eq('team_id', teamId).maybeSingle(),
    supabase.from('team_members').select('profile_id, role, responsibility_ar').eq('team_id', teamId),
  ]);

  const memberIds = (members ?? []).map((row) => row.profile_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, techmood_id')
    .in('id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar} — الإعدادات</h2>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>نظرة عامة</Link>
        </div>
      </section>

      <TeamNav teamId={teamId} />

      <SettingsForm team={team as Team} />

      <PermissionsForm
        teamId={teamId}
        permissions={permissions ?? null}
      />

      <MembersAdmin
        teamId={teamId}
        leaderId={team.leader_id}
        members={(members ?? []).map((row) => ({
          profileId: row.profile_id,
          role: row.role,
          responsibility: row.responsibility_ar,
          name: profileById.get(row.profile_id)?.full_name ?? '—',
          techmoodId: profileById.get(row.profile_id)?.techmood_id ?? '',
        }))}
      />
    </>
  );
}
