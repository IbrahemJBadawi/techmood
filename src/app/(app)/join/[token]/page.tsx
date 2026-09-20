import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { TEAM_KIND } from '@/lib/teams';

import { AcceptInvite } from './AcceptInvite';

export default async function JoinTeamPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  const { data: invite } = await supabase
    .from('team_invites')
    .select('id, team_id, invitee_id, responsibility_ar, status, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
    return (
      <>
        <p className="notice notice-danger">هذه الدعوة لم تعد صالحة.</p>
        <Link className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} href="/teams">الفرق</Link>
      </>
    );
  }

  const { data: team } = await supabase
    .from('teams')
    .select('title_ar, description_ar, kind, team_code')
    .eq('id', invite.team_id)
    .maybeSingle();

  return (
    <section className="panel" style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: '1.15rem' }}>دعوة للانضمام</h2>
      <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
        دُعيت للانضمام إلى <strong>{team?.title_ar}</strong>
        {invite.responsibility_ar && <> بمسؤولية <strong>{invite.responsibility_ar}</strong></>}.
      </p>

      <div className="tags-row" style={{ marginTop: 12 }}>
        <span className="id-chip">{team?.team_code}</span>
        {team?.kind && <span className="tag">{TEAM_KIND[team.kind]}</span>}
      </div>

      {team?.description_ar && (
        <p style={{ fontSize: '0.88rem', marginTop: 12 }}>{team.description_ar}</p>
      )}

      <p className="muted" style={{ fontSize: '0.78rem', marginTop: 14 }}>
        ستنضم بحسابك الحالي وهويتك في TechMood — لا حساب جديد ولا هوية ثانية.
      </p>

      <AcceptInvite token={token} />
    </section>
  );
}
