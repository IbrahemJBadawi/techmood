import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';

import { TeamNav } from '../TeamNav';
import { InviteForm } from './InviteForm';

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, title_ar, leader_id').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: members }, { data: invites }, { data: tasks }, { data: canInvite }] = await Promise.all([
    supabase.from('team_members').select('profile_id, role, responsibility_ar, joined_at').eq('team_id', teamId),
    supabase.from('team_invites').select('id, invitee_id, responsibility_ar, status, expires_at').eq('team_id', teamId).eq('status', 'pending'),
    supabase.from('team_tasks').select('id, assignee_id, column_key').eq('team_id', teamId),
    supabase.rpc('team_permission', { p_team: teamId, p_permission: 'members_invite' }),
  ]);

  const peopleIds = [
    ...new Set([
      ...(members ?? []).map((row) => row.profile_id),
      ...(invites ?? []).map((row) => row.invitee_id).filter(Boolean) as string[],
    ]),
  ];

  const [{ data: profiles }, { data: xp }, { data: stars }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, techmood_id, headline').in('id', peopleIds.length ? peopleIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('profile_xp').select('profile_id, total_xp').in('profile_id', peopleIds.length ? peopleIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('profile_stars').select('profile_id, stars_avg').in('profile_id', peopleIds.length ? peopleIds : ['00000000-0000-0000-0000-000000000000']),
  ]);

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const xpById = new Map((xp ?? []).map((row) => [row.profile_id, row.total_xp]));
  const starsById = new Map((stars ?? []).map((row) => [row.profile_id, row.stars_avg]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar} — الأعضاء</h2>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>نظرة عامة</Link>
        </div>
      </section>

      <TeamNav teamId={teamId} />

      {canInvite === true && <InviteForm teamId={teamId} />}

      <div className="card-grid">
        {(members ?? []).map((member) => {
          const profile = profileById.get(member.profile_id);
          const mine = (tasks ?? []).filter((task) => task.assignee_id === member.profile_id);
          const done = mine.filter((task) => task.column_key === 'done').length;

          return (
            <article className="card" key={member.profile_id}>
              <div className="row-between">
                <h3>{profile?.full_name ?? '—'}</h3>
                {member.role === 'leader' && <span className="badge-pill">قائد الفريق</span>}
              </div>

              <span className="id-chip">{profile?.techmood_id}</span>
              {member.responsibility_ar && <span className="tag">{member.responsibility_ar}</span>}
              {profile?.headline && <p>{profile.headline}</p>}

              <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                <span className="eng">{done}/{mine.length} مهمة</span>
                <span>
                  <Stars value={starsById.get(member.profile_id) ?? 0} />{' '}
                  <span className="xp-badge eng">{xpById.get(member.profile_id) ?? 0} XP</span>
                </span>
              </div>

              <p className="muted eng" style={{ fontSize: '0.74rem' }}>
                انضم {new Date(member.joined_at).toLocaleDateString('ar-EG')}
              </p>
            </article>
          );
        })}
      </div>

      {(invites?.length ?? 0) > 0 && (
        <section className="section-block" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>دعوات معلّقة</h3>
          <table className="data">
            <thead><tr><th>المدعو</th><th>المسؤولية</th><th>تنتهي</th></tr></thead>
            <tbody>
              {invites!.map((invite) => (
                <tr key={invite.id}>
                  <td>
                    {profileById.get(invite.invitee_id ?? '')?.full_name ?? 'رابط دعوة'}
                    <br />
                    <span className="id-chip">{profileById.get(invite.invitee_id ?? '')?.techmood_id}</span>
                  </td>
                  <td>{invite.responsibility_ar ?? '—'}</td>
                  <td className="eng">{new Date(invite.expires_at).toLocaleDateString('ar-EG')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
