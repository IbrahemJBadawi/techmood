import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { MEMBER_ROLE } from '@/lib/incubator';
import type { StartupMemberRole } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { MemberForm } from './MemberForm';
import { removeMember, setMemberRole } from './actions';

const ROLES = Object.keys(MEMBER_ROLE) as StartupMemberRole[];

/**
 * Who is in the room, and what each of them may do in it.
 *
 * Running, working and reading are three different questions here — a
 * freelancer brought in for one project should not be able to rewrite the
 * strategy, and an advisor should not be able to hire.
 */
export default async function StartupTeamPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase
    .from('startups').select('id, name_ar, founder_id').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: members }, { data: canManage }] = await Promise.all([
    supabase.from('startup_members').select('profile_id, role, title_ar, joined_at')
      .eq('startup_id', startupId).order('joined_at'),
    supabase.rpc('can_manage_startup', { p_startup: startupId }),
  ]);

  const ids = (members ?? []).map((row) => row.profile_id);
  const { data: people } = await supabase
    .from('profiles').select('id, full_name, techmood_id, headline')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const personOf = new Map((people ?? []).map((row) => [row.id, row]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — الفريق', ' — the team')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('حساب واحد لكل شخص: من تضيفه هنا يدخل بهويته المهنية في TechMood، لا بحساب ثانٍ. والدور يقرّر ما يستطيع فعله داخل المساحة.',
             'One account per person: whoever you add here comes in with their TechMood identity, not a second login. Their role decides what they can do in the room.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      <section className="section-block">
        <table className="data booking-table">
          <thead>
            <tr>
              <th>{t('العضو', 'Member')}</th>
              <th>{t('المسمّى', 'Title')}</th>
              <th>{t('الدور', 'Role')}</th>
              <th>{t('يستطيع', 'Can')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((member) => {
              const person = personOf.get(member.profile_id);
              const isFounder = member.profile_id === startup.founder_id;

              return (
                <tr key={member.profile_id}>
                  <td data-label={t('العضو', 'Member')}>
                    <Link href={`/u/${person?.techmood_id ?? ''}`}>{person?.full_name ?? '—'}</Link>
                    {person?.headline && <p className="muted" style={{ fontSize: '0.78rem' }}>{person.headline}</p>}
                  </td>
                  <td data-label={t('المسمّى', 'Title')} className="muted">{member.title_ar ?? '—'}</td>
                  <td data-label={t('الدور', 'Role')}>
                    {canManage === true && !isFounder ? (
                      <form action={setMemberRole} className="row-actions">
                        <input type="hidden" name="startup_id" value={startupId} />
                        <input type="hidden" name="profile_id" value={member.profile_id} />
                        <select name="role" defaultValue={member.role}>
                          {ROLES.filter((role) => role !== 'founder').map((role) => (
                            <option key={role} value={role}>{t(MEMBER_ROLE[role].label)}</option>
                          ))}
                        </select>
                        <button className="btn btn-ghost btn-sm">{t('احفظ', 'Save')}</button>
                      </form>
                    ) : (
                      <span className="badge-pill">{t(MEMBER_ROLE[member.role].label)}</span>
                    )}
                  </td>
                  <td data-label={t('يستطيع', 'Can')} className="muted">{t(MEMBER_ROLE[member.role].can)}</td>
                  <td>
                    {canManage === true && !isFounder && (
                      <form action={removeMember}>
                        <input type="hidden" name="startup_id" value={startupId} />
                        <input type="hidden" name="profile_id" value={member.profile_id} />
                        <button className="btn btn-ghost btn-sm">{t('أخرجه', 'Remove')}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {canManage === true && (
        <section className="section-block">
          <h3 className="academy-heading">{t('أضف شخصاً', 'Add somebody')}</h3>
          <MemberForm startupId={startupId} />
        </section>
      )}
    </>
  );
}
