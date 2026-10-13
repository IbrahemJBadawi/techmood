import Link from 'next/link';

import { ActionForm } from '@/components/ActionForm';
import { notFound, redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';

import { TeamNav } from '../TeamNav';
import { InviteForm } from './InviteForm';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';
import { decideJoin, saveOpening } from '../../join-actions';

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, title_ar, leader_id').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: members }, { data: invites }, { data: tasks }, { data: canInvite }, { data: requests }, { data: openings }, { data: roleRows }] = await Promise.all([
    supabase.from('team_members').select('profile_id, role, responsibility_ar, joined_at').eq('team_id', teamId),
    supabase.from('team_invites').select('id, invitee_id, responsibility_ar, status, expires_at').eq('team_id', teamId).eq('status', 'pending'),
    supabase.from('team_tasks').select('id, assignee_id, column_key').eq('team_id', teamId),
    supabase.rpc('team_permission', { p_team: teamId, p_permission: 'members_invite' }),
    // people asking to join from a project page (0156) — the leader's to answer
    supabase.rpc('team_join_requests', { p_team: teamId }),
    // the roles the team is looking for (0170), and which one each request is for
    supabase.from('team_openings').select('id, role_ar, seats, skills, is_open').eq('team_id', teamId).order('created_at'),
    supabase.from('team_applications').select('id, role_wanted').eq('team_id', teamId).eq('status', 'pending'),
  ]);
  const roleOf = new Map((roleRows ?? []).map((row) => [row.id, row.role_wanted]));
  const isLeader = team.leader_id === user.id;

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
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar}{t(' — الأعضاء', ' — members')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>{t('نظرة عامة', 'Overview')}</Link>
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
                {member.role === 'leader' && <span className="badge-pill">{t('قائد الفريق', 'Team lead')}</span>}
              </div>

              <span className="id-chip">{profile?.techmood_id}</span>
              {member.responsibility_ar && <span className="tag">{member.responsibility_ar}</span>}
              {profile?.headline && <p>{profile.headline}</p>}

              <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                <span className="eng">{done}/{mine.length} {t('مهمة', 'tasks')}</span>
                <span>
                  <Stars value={starsById.get(member.profile_id) ?? 0} />{' '}
                  <span className="xp-badge eng">{xpById.get(member.profile_id) ?? 0} XP</span>
                </span>
              </div>

              <p className="muted eng" style={{ fontSize: '0.74rem' }}>
                {t('انضم ', 'Joined ')}{formatDate(t.locale, member.joined_at)}
              </p>
            </article>
          );
        })}
      </div>

      {(requests ?? []).length > 0 && (
        <section className="section-block" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>🙋 {t(`طلبات انضمام (${requests!.length})`, `Join requests (${requests!.length})`)}</h3>
          <ul className="join-requests">
            {requests!.map((request) => (
              <li key={request.id} className="panel">
                <div>
                  <strong>{request.techmood_id ? <Link href={`/u/${request.techmood_id}`}>{request.full_name}</Link> : request.full_name}</strong>
                  {request.headline && <span className="muted"> · {request.headline}</span>}
                  {roleOf.get(request.id) && <span className="tag join-role">{t('للدور: ', 'For: ')}{roleOf.get(request.id)}</span>}
                  {request.message_ar && <p style={{ fontSize: '0.86rem', marginTop: 6 }}>«{request.message_ar}»</p>}
                </div>
                <form action={decideJoin} className="row-actions">
                  <input type="hidden" name="application_id" value={request.id} />
                  <input type="hidden" name="team_id" value={teamId} />
                  <button className="btn btn-primary btn-sm" name="decision" value="accept">{t('✓ اقبل', '✓ Accept')}</button>
                  <button className="btn btn-ghost btn-sm" name="decision" value="decline">{t('اعتذر', 'Decline')}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(isLeader || (openings ?? []).length > 0) && (
        <section className="section-block" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>{t('الأعضاء المطلوبون', 'Members the team is looking for')}</h3>
          <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
            {t('الأدوار المفتوحة تظهر في «فرق تطلب أعضاء»، ويُغلق الدور وحده حين يُقبل العدد المطلوب.',
               'Open roles show under «teams looking for members»; a role closes on its own once enough people are accepted.')}
          </p>
          {(openings ?? []).length > 0 && (
            <ul className="opening-list">
              {(openings ?? []).map((opening) => (
                <li key={opening.id} className={`panel${opening.is_open ? '' : ' is-closed'}`}>
                  <div>
                    <strong>{opening.role_ar}</strong>
                    <span className="muted"> · {t(`مطلوب ${opening.seats}`, `${opening.seats} wanted`)}</span>
                    {opening.skills.length > 0 && <span className="muted" dir="auto"> · {opening.skills.join('، ')}</span>}
                  </div>
                  {isLeader ? (
                    <ActionForm action={saveOpening} variant="ghost" submitLabel={opening.is_open ? t('أغلق الدور', 'Close the role') : t('أعد فتحه', 'Reopen')}>
                      <input type="hidden" name="team_id" value={teamId} />
                      <input type="hidden" name="id" value={opening.id} />
                      <input type="hidden" name="is_open" value={String(!opening.is_open)} />
                    </ActionForm>
                  ) : (
                    <span className={`status-pill ${opening.is_open ? 'status-ok' : 'status-muted'}`}>{opening.is_open ? t('مفتوح', 'Open') : t('مغلق', 'Closed')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isLeader && (
            <ActionForm action={saveOpening} submitLabel={t('+ أضف دوراً', '+ Add a role')} className="panel opening-add">
              <input type="hidden" name="team_id" value={teamId} />
              <input name="role" required minLength={2} maxLength={60} placeholder={t('الدور، مثال: مصمم واجهات', 'Role, e.g. UI designer')} aria-label={t('الدور', 'Role')} />
              <select name="seats" defaultValue="1" aria-label={t('العدد', 'How many')}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input name="skills" dir="auto" placeholder={t('مهارات (مفصولة بفاصلة)', 'Skills (comma separated)')} aria-label={t('المهارات', 'Skills')} />
            </ActionForm>
          )}
        </section>
      )}

      {(invites?.length ?? 0) > 0 && (
        <section className="section-block" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('دعوات معلّقة', 'Pending invitations')}</h3>
          <table className="data">
            <thead><tr><th>{t('المدعو', 'Invitee')}</th><th>{t('المسؤولية', 'Responsibility')}</th><th>{t('تنتهي', 'Expires')}</th></tr></thead>
            <tbody>
              {invites!.map((invite) => (
                <tr key={invite.id}>
                  <td>
                    {profileById.get(invite.invitee_id ?? '')?.full_name ?? t('رابط دعوة', 'Invite link')}
                    <br />
                    <span className="id-chip">{profileById.get(invite.invitee_id ?? '')?.techmood_id}</span>
                  </td>
                  <td>{invite.responsibility_ar ?? '—'}</td>
                  <td className="date">{new Date(invite.expires_at).toLocaleDateString('ar-EG-u-nu-latn', { timeZone: PLATFORM_TIME_ZONE })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
