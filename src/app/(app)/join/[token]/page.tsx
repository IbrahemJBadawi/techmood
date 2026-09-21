import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TEAM_KIND } from '@/lib/teams';

import { AcceptInvite } from './AcceptInvite';

export default async function JoinTeamPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getT();
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
        <p className="notice notice-danger">{t('هذه الدعوة لم تعد صالحة.', 'This invitation is no longer valid.')}</p>
        <Link className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} href="/teams">{t('الفرق', 'Teams')}</Link>
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
      <h2 style={{ fontSize: '1.15rem' }}>{t('دعوة للانضمام', 'An invitation to join')}</h2>
      <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
        {t('دُعيت للانضمام إلى ', 'You have been invited to join ')}<strong>{team?.title_ar}</strong>
        {invite.responsibility_ar && <>{t(' بمسؤولية ', ' as ')}<strong>{invite.responsibility_ar}</strong></>}.
      </p>

      <div className="tags-row" style={{ marginTop: 12 }}>
        <span className="id-chip">{team?.team_code}</span>
        {team?.kind && <span className="tag">{t(TEAM_KIND[team.kind])}</span>}
      </div>

      {team?.description_ar && (
        <p style={{ fontSize: '0.88rem', marginTop: 12 }}>{team.description_ar}</p>
      )}

      <p className="muted" style={{ fontSize: '0.78rem', marginTop: 14 }}>
        {t('ستنضم بحسابك الحالي وهويتك في TechMood — لا حساب جديد ولا هوية ثانية.', 'You join with the account and TechMood identity you already have — no new account, no second identity.')}
      </p>

      <AcceptInvite token={token} />
    </section>
  );
}
