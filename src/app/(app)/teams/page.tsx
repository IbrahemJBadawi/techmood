import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { Stars } from '@/components/Stars';
import { avatarColor } from '@/lib/mentor-look';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { TEAM_KIND, TEAM_STATUS } from '@/lib/teams';

import { ApplyOpening } from './ApplyOpening';

export const generateMetadata = localizedTitle('الفرق — TechMood', 'Teams — TechMood');

export default async function TeamsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, role, responsibility_ar')
    .eq('profile_id', user.id);

  const teamIds = (memberships ?? []).map((row) => row.team_id);
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: teams }, { data: xp }, { data: stars }, { data: invites }, { data: board }, { data: myOpenings }] = await Promise.all([
    supabase.from('teams').select('*').in('id', teamIds.length ? teamIds : placeholder),
    supabase.from('team_xp').select('team_id, total_xp').in('team_id', teamIds.length ? teamIds : placeholder),
    supabase.from('team_stars').select('team_id, stars_avg').in('team_id', teamIds.length ? teamIds : placeholder),
    supabase
      .from('team_invites')
      .select('id, team_id, token, responsibility_ar, teams(title_ar)')
      .eq('invitee_id', user.id)
      .eq('status', 'pending'),
    // teams looking for members (0170)
    supabase.rpc('team_openings_board', { p_limit: 30 }),
    supabase.from('team_openings').select('team_id').eq('is_open', true).in('team_id', teamIds.length ? teamIds : placeholder),
  ]);
  const openSeatsOf = new Map<string, number>();
  for (const row of myOpenings ?? []) openSeatsOf.set(row.team_id, (openSeatsOf.get(row.team_id) ?? 0) + 1);
  // the board shows other teams' seats; my own teams are above
  const seats = (board ?? []).filter((row) => !teamIds.includes(row.team_id));

  const counts = await Promise.all(
    teamIds.map(async (teamId) => {
      const [{ count: total }, { count: done }, { count: members }] = await Promise.all([
        supabase.from('team_tasks').select('*', { count: 'exact', head: true }).eq('team_id', teamId),
        supabase.from('team_tasks').select('*', { count: 'exact', head: true }).eq('team_id', teamId).eq('column_key', 'done'),
        supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', teamId),
      ]);
      return { teamId, total: total ?? 0, done: done ?? 0, members: members ?? 0 };
    }),
  );

  const xpById = new Map((xp ?? []).map((row) => [row.team_id, row.total_xp]));
  const starsById = new Map((stars ?? []).map((row) => [row.team_id, row.stars_avg]));
  const countsById = new Map(counts.map((row) => [row.teamId, row]));
  const roleById = new Map((memberships ?? []).map((row) => [row.team_id, row]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>{t('الفرق', 'Teams')}</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
              {t('الفرق التي تتعلّم أو تنفّذ مشاريع من خلالها. مساحة عمل مغلقة — وليست مجتمعاً عاماً.', 'The teams you learn or build through. A closed workspace — not a public community.')}
            </p>
          </div>
          <Link className="btn btn-primary btn-sm" href="/teams/new">{t('+ أنشئ فريقاً', '+ New team')}</Link>
        </div>
      </section>

      {(invites?.length ?? 0) > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('دعوات بانتظارك', 'Invitations waiting for you')}</h3>
          {invites!.map((invite) => (
            <div className="panel row-between" key={invite.id} style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>
                {t('دعوة للانضمام إلى ', 'An invitation to join ')}
                <strong>{(invite.teams as unknown as { title_ar: string } | null)?.title_ar}</strong>
                {invite.responsibility_ar && <span className="muted"> — {invite.responsibility_ar}</span>}
              </span>
              <Link className="btn btn-primary btn-sm" href={`/join/${invite.token}`}>{t('عرض الدعوة', 'View invitation')}</Link>
            </div>
          ))}
        </section>
      )}

      {(teams?.length ?? 0) === 0 ? (
        <p className="notice">
          {t('لست عضواً في أي فريق بعد. أنشئ فريقك، أو انتظر دعوة من قائد فريق عبر TechMood ID.', 'You are not in a team yet. Start one, or wait for a team lead to invite you by TechMood ID.')}
        </p>
      ) : (
        <div className="team-grid section-block">
          {teams!.map((team) => {
            const count = countsById.get(team.id);
            const progress = count && count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
            const status = TEAM_STATUS[team.status];
            const role = roleById.get(team.id);

            return (
              <article className="lcard" key={team.id} style={{ '--hue': avatarColor(team.id) } as React.CSSProperties}>
                <div className="lcard-cover">
                  <span className="lcard-icon"><Icon name="team" size={22} /></span>
                  <span className="lcard-school">{t(TEAM_KIND[team.kind])}</span>
                  <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
                </div>
                <div className="lcard-body">
                  <h3>{team.title_ar}</h3>
                  {team.description_ar && <p className="lcard-desc">{team.description_ar}</p>}
                  <ul className="lcard-meta">
                    <li><Icon name="team" size={14} />{t(`${count?.members ?? 0} أعضاء`, `${count?.members ?? 0} members`)}</li>
                    <li><Icon name="check" size={14} /><span className="eng">{count?.done ?? 0}/{count?.total ?? 0}</span>&nbsp;{t('مهمة', 'tasks')}</li>
                    <li className="lcard-xp"><span className="eng">{xpById.get(team.id) ?? 0} XP</span></li>
                    {role?.role === 'leader' && <li>{t('أنت القائد', 'You lead it')}</li>}
                    {(openSeatsOf.get(team.id) ?? 0) > 0 && (
                      <li className="team-seeking">{t(`يبحث عن ${openSeatsOf.get(team.id)} ${openSeatsOf.get(team.id) === 1 ? 'دور' : 'أدوار'}`, `Looking for ${openSeatsOf.get(team.id)} role${openSeatsOf.get(team.id) === 1 ? '' : 's'}`)}</li>
                    )}
                    {role?.responsibility_ar && <li>{role.responsibility_ar}</li>}
                  </ul>
                  <div className="lcard-bar">
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                    <span className="eng">{progress}%</span>
                  </div>
                  <Stars value={starsById.get(team.id) ?? 0} />
                </div>
                <div className="lcard-foot">
                  <Link className="btn btn-primary btn-sm" href={`/teams/${team.id}`}>{t('افتح مساحة العمل', 'Open the workspace')}</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* «طلبات الفرق»: open seats of listed teams (0170) */}
      <section className="section-block">
        <div className="row-between">
          <div>
            <h2 style={{ fontSize: '1.1rem' }}>🙋 {t('فرق تطلب أعضاء', 'Teams looking for members')}</h2>
            <p className="muted" style={{ fontSize: '0.86rem', marginTop: 4 }}>
              {t('أدوار حدّدها قادة الفرق — اطلب الدور الذي يناسبك، ويقرر القائد.', 'Roles team leads named — apply for the one that fits you, and the lead decides.')}
            </p>
          </div>
        </div>
        {seats.length === 0 ? (
          <p className="notice" style={{ marginTop: 12 }}>
            {t('لا أدوار مفتوحة الآن. أنشئ فريقك وحدّد الأدوار التي تحتاجها، فيظهر هنا للجميع.', 'No open roles right now. Start your team and name the roles it needs — it shows up here for everyone.')}
          </p>
        ) : (
          <div className="seat-grid">
            {seats.map((seat) => (
              <article className="seat-card" key={seat.opening_id} style={{ '--hue': avatarColor(seat.team_id) } as React.CSSProperties}>
                <header className="seat-head">
                  <span className="seat-icon" aria-hidden="true"><Icon name="team" size={18} /></span>
                  <div>
                    <strong>{seat.team_title}</strong>
                    <span className="muted">
                      {TEAM_KIND[seat.team_kind as keyof typeof TEAM_KIND] ? t(TEAM_KIND[seat.team_kind as keyof typeof TEAM_KIND]) : seat.team_kind}
                      {seat.leader_name && <> · {t('بقيادة ', 'led by ')}{seat.leader_name}</>}
                    </span>
                  </div>
                </header>
                <p className="seat-role">{seat.role_ar}</p>
                <p className="seat-count">
                  {t(`مطلوب ${seat.seats}`, `${seat.seats} wanted`)}
                  {seat.filled > 0 && <> · {t(`قُبل ${seat.filled}`, `${seat.filled} accepted`)}</>}
                  {' · '}{t(`${seat.members} في الفريق الآن`, `${seat.members} in the team now`)}
                </p>
                {seat.skills.length > 0 && (
                  <ul className="seat-skills">{seat.skills.map((skill) => <li key={skill} dir="auto">{skill}</li>)}</ul>
                )}
                {seat.team_focus && <p className="muted seat-focus">{seat.team_focus}</p>}
                <div className="seat-foot">
                  {/* one request per team: this seat's own status, or a note on the team's other seats */}
                  {seat.my_status === 'pending' || seat.my_status === 'accepted'
                    ? seat.my_opening === seat.opening_id
                      ? <span className={`status-pill ${seat.my_status === 'accepted' ? 'status-ok' : 'status-pending'}`}>
                          {seat.my_status === 'accepted' ? t('قُبلت', 'Accepted') : t('طلبك قيد المراجعة', 'Your request is pending')}
                        </span>
                      : <span className="status-pill status-muted">{t('لك طلب في هذا الفريق', 'You already asked this team')}</span>
                    : <ApplyOpening openingId={seat.opening_id} role={seat.role_ar} />}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
