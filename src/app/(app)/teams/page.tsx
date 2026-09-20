import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { TEAM_KIND, TEAM_STATUS } from '@/lib/teams';

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, role, responsibility_ar')
    .eq('profile_id', user.id);

  const teamIds = (memberships ?? []).map((row) => row.team_id);
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: teams }, { data: xp }, { data: stars }, { data: invites }] = await Promise.all([
    supabase.from('teams').select('*').in('id', teamIds.length ? teamIds : placeholder),
    supabase.from('team_xp').select('team_id, total_xp').in('team_id', teamIds.length ? teamIds : placeholder),
    supabase.from('team_stars').select('team_id, stars_avg').in('team_id', teamIds.length ? teamIds : placeholder),
    supabase
      .from('team_invites')
      .select('id, team_id, token, responsibility_ar, teams(title_ar)')
      .eq('invitee_id', user.id)
      .eq('status', 'pending'),
  ]);

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
            <h2 style={{ fontSize: '1.2rem' }}>الفرق</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
              الفرق التي تتعلّم أو تنفّذ مشاريع من خلالها. مساحة عمل مغلقة — وليست مجتمعاً عاماً.
            </p>
          </div>
          <Link className="btn btn-primary btn-sm" href="/teams/new">+ أنشئ فريقاً</Link>
        </div>
      </section>

      {(invites?.length ?? 0) > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>دعوات بانتظارك</h3>
          {invites!.map((invite) => (
            <div className="panel row-between" key={invite.id} style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>
                دعوة للانضمام إلى{' '}
                <strong>{(invite.teams as unknown as { title_ar: string } | null)?.title_ar}</strong>
                {invite.responsibility_ar && <span className="muted"> — {invite.responsibility_ar}</span>}
              </span>
              <Link className="btn btn-primary btn-sm" href={`/join/${invite.token}`}>عرض الدعوة</Link>
            </div>
          ))}
        </section>
      )}

      {(teams?.length ?? 0) === 0 ? (
        <p className="notice">
          لست عضواً في أي فريق بعد. أنشئ فريقك، أو انتظر دعوة من قائد فريق عبر TechMood ID.
        </p>
      ) : (
        <div className="card-grid">
          {teams!.map((team) => {
            const count = countsById.get(team.id);
            const progress = count && count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
            const status = TEAM_STATUS[team.status];
            const role = roleById.get(team.id);

            return (
              <article className="card" key={team.id}>
                <div className="row-between">
                  <span className="id-chip">{team.team_code}</span>
                  <span className={`status-pill ${status.className}`}>{status.text}</span>
                </div>

                <h3>{team.title_ar}</h3>
                <div className="tags-row">
                  <span className="tag">{TEAM_KIND[team.kind]}</span>
                  {role?.role === 'leader' && <span className="badge-pill">قائد الفريق</span>}
                  {role?.responsibility_ar && <span className="badge-pill">{role.responsibility_ar}</span>}
                </div>

                {team.description_ar && <p>{team.description_ar}</p>}

                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <div className="row-between" style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                  <span className="eng">{count?.done ?? 0}/{count?.total ?? 0} مهمة</span>
                  <span className="eng">{progress}%</span>
                </div>

                <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                  <span>👥 {count?.members ?? 0} أعضاء</span>
                  <span>
                    <Stars value={starsById.get(team.id) ?? 0} />{' '}
                    <span className="xp-badge eng">{xpById.get(team.id) ?? 0} XP</span>
                  </span>
                </div>

                <Link className="btn btn-ghost btn-sm" href={`/teams/${team.id}`}>افتح مساحة العمل</Link>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
