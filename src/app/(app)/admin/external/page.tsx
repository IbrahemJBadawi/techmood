import { redirect } from 'next/navigation';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';

import { reviewClaim } from './actions';

export const metadata = { title: 'External claims — TechMood' };

/**
 * The only queue on the platform for something it did not witness.
 *
 * Everything else an admin reviews is a piece of work that lives here — a
 * submission, a project, a payment. This is a person saying "I took part in
 * something, somewhere else", which is exactly why it needs a human to look at
 * the evidence before it becomes part of a TechMood record.
 */
export default async function ExternalClaimsPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('can_enter_role', { p_role: 'admin' });
  if (!isAdmin) redirect('/home');

  const { data: claims } = await supabase
    .from('external_exhibitions')
    .select('id, profile_id, title, organiser, role_ar, result_ar, evidence_url, held_on, status, created_at')
    .eq('status', 'pending_review')
    .order('created_at');

  const profileIds = [...new Set((claims ?? []).map((row) => row.profile_id))];
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name, techmood_id').in('id', profileIds)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((row) => [row.id, row]));

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('مشاركات خارجية بانتظار التحقّق', 'External claims waiting to be checked')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '66ch' }}>
          {t('هذه الأشياء لم تحدث داخل TechMood، فلا سجلّ لها هنا. افتح الدليل وقرّر: ما تعتمده يصبح جزءاً من هوية صاحبه، وما ترفضه يبقى عنده وحده.',
             'These happened outside TechMood, so there is no record of them here. Open the evidence and decide: what you approve becomes part of that person’s identity, what you refuse stays theirs alone.')}
        </p>
      </section>

      {(claims?.length ?? 0) === 0 ? (
        <p className="notice">{t('لا مشاركات بانتظار التحقّق 🎉', 'Nothing waiting 🎉')}</p>
      ) : (
        (claims ?? []).map((claim) => {
          const owner = byId.get(claim.profile_id);
          return (
            <article className="panel section-block" key={claim.id}>
              <div className="row-between">
                <div>
                  <h3 style={{ fontSize: '1rem' }}>{claim.title}</h3>
                  <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
                    {owner && (
                      <Link href={`/u/${owner.techmood_id}`}>{owner.full_name}</Link>
                    )}
                    {claim.organiser && <> · {claim.organiser}</>}
                    {claim.held_on && <> · <span className="eng">{formatDate(locale, claim.held_on)}</span></>}
                  </p>
                </div>
                {claim.evidence_url && (
                  <a className="btn btn-ghost btn-sm" href={claim.evidence_url} target="_blank" rel="noreferrer noopener">
                    {t('الدليل ↗', 'Evidence ↗')}
                  </a>
                )}
              </div>

              {(claim.role_ar || claim.result_ar) && (
                <p className="muted" style={{ fontSize: '0.86rem', marginTop: 10 }}>
                  {claim.role_ar}{claim.role_ar && claim.result_ar ? ' · ' : ''}{claim.result_ar}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <form action={reviewClaim}>
                  <input type="hidden" name="entry_id" value={claim.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="btn btn-primary btn-sm">{t('تحقّقت منها', 'Checked — approve')}</button>
                </form>
                <form action={reviewClaim} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
                  <input type="hidden" name="entry_id" value={claim.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <input name="note" required placeholder={t('السبب — يظهر لصاحبها', 'Why — they will see this')} style={{ flex: 1, minWidth: 0 }} />
                  <button className="btn btn-ghost btn-sm">{t('لا تُعتمد', 'Refuse')}</button>
                </form>
              </div>
            </article>
          );
        })
      )}
    </>
  );
}
