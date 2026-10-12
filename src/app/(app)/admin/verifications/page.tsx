import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';
import { VerifiedBadge } from '@/components/VerifiedBadge';

import { RevokeForm, VerificationReviewForm } from './ReviewForm';

export const generateMetadata = localizedTitle('توثيق الهويات — الإدارة', 'Identity checks — Admin');

/** Identity checks waiting on an admin, and who already carries the ✓ (0161). */
export default async function AdminVerificationsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const [{ data: waiting }, { data: verified }] = await Promise.all([
    supabase.from('identity_verifications').select('id, profile_id, legal_name, document_path, created_at')
      .eq('status', 'pending').order('created_at'),
    supabase.from('verified_members').select('profile_id, since').order('since', { ascending: false }).limit(100),
  ]);

  const ids = [...(waiting ?? []).map((row) => row.profile_id), ...(verified ?? []).map((row) => row.profile_id)];
  const { data: people } = await supabase.from('profiles').select('id, full_name, techmood_id')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const personOf = new Map((people ?? []).map((row) => [row.id, row]));

  const links = new Map<string, string>();
  for (const row of waiting ?? []) {
    if (!row.document_path) continue;
    const { data } = await supabase.storage.from('identity-docs').createSignedUrl(row.document_path, 600);
    if (data?.signedUrl) links.set(row.id, data.signedUrl);
  }
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('توثيق الهويات', 'Identity checks')} <VerifiedBadge /></h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('قارن الاسم في الوثيقة باسم الحساب وصورته. القرار يحذف الوثيقة تلقائياً — لا تحفظها في أي مكان آخر.',
             'Match the name on the document with the account name and photo. Deciding deletes the document automatically — do not keep it anywhere else.')}
        </p>
      </section>

      {(waiting ?? []).length === 0 ? (
        <div className="panel empty-state"><h3 style={{ fontSize: '0.98rem' }}>{t('لا طلبات بانتظار المراجعة', 'Nothing waiting')}</h3></div>
      ) : (
        <ul className="biz-inbox section-block">
          {(waiting ?? []).map((row) => {
            const person = personOf.get(row.profile_id);
            return (
              <li key={row.id} className="panel">
                <div className="row-between">
                  <strong>{row.legal_name}</strong>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>{time.format(new Date(row.created_at))}</span>
                </div>
                <p className="muted" style={{ fontSize: '0.84rem' }}>
                  {t('الحساب: ', 'Account: ')}
                  {person?.techmood_id ? <Link href={`/admin/users/${row.profile_id}`}>{person.full_name}</Link> : person?.full_name}
                  {person?.techmood_id && <> <span className="id-chip">{person.techmood_id}</span></>}
                </p>
                {links.get(row.id) && <a className="btn btn-ghost btn-sm" href={links.get(row.id)} target="_blank" rel="noopener noreferrer">🪪 {t('افتح الوثيقة', 'Open the document')}</a>}
                <VerificationReviewForm id={row.id} />
              </li>
            );
          })}
        </ul>
      )}

      {(verified ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('الحسابات الموثّقة', 'Verified accounts')}</h3>
          <table className="data">
            <tbody>
              {(verified ?? []).map((row) => {
                const person = personOf.get(row.profile_id);
                return (
                  <tr key={row.profile_id}>
                    <td>{person?.full_name} <VerifiedBadge /></td>
                    <td className="eng">{person?.techmood_id}</td>
                    <td className="muted" style={{ fontSize: '0.8rem' }}>{time.format(new Date(row.since))}</td>
                    <td><RevokeForm profileId={row.profile_id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
