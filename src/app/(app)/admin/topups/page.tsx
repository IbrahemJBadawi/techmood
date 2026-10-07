import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { TopupReviewForm } from './ReviewForm';

export const generateMetadata = localizedTitle('شحن الأرصدة — إدارة TechMood', 'Top-ups — TechMood admin');

/** Top-ups waiting for a person to check the receipt, oldest first (0151). */
export default async function AdminTopupsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const [{ data: waiting }, { data: recent }] = await Promise.all([
    supabase.from('credit_topups')
      .select('id, topup_code, profile_id, amount_usd, method_key, reference, proof_path, submitted_at, purpose, purpose_label, profiles!credit_topups_profile_id_fkey(full_name, techmood_id)')
      .eq('status', 'under_review').order('submitted_at'),
    supabase.from('credit_topups')
      .select('id, topup_code, amount_usd, status, reviewed_at, purpose, purpose_label, fulfilled_at')
      .in('status', ['approved', 'rejected']).order('reviewed_at', { ascending: false }).limit(20),
  ]);
  // the receipts are private: a link that works for a few minutes, for the admin only
  const links = new Map<string, string>();
  for (const row of waiting ?? []) {
    if (!row.proof_path) continue;
    const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(row.proof_path, 600);
    if (data?.signedUrl) links.set(row.id, data.signedUrl);
  }
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('شحن الأرصدة والدفع بتحويل', 'Top-ups and transfers')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('قارن الإيصال بما وصل فعلاً إلى الحساب قبل الموافقة. شحن الرصيد يُضاف للرصيد (يُصرف داخل المنصة ولا يُسحب)، والدفع لـ Premium أو باقة يُفعّلهما فور موافقتك.', 'Match the receipt with what actually arrived before approving. A top-up goes into the balance (spent on the platform, not withdrawable); a payment for Premium or a package activates it as soon as you approve.')}
        </p>
      </section>

      {(waiting ?? []).length === 0 ? (
        <div className="panel empty-state"><h3 style={{ fontSize: '0.98rem' }}>{t('لا طلبات بانتظار المراجعة', 'Nothing waiting')}</h3></div>
      ) : (
        <ul className="biz-inbox section-block">
          {(waiting ?? []).map((row) => {
            const person = row.profiles as unknown as { full_name: string | null; techmood_id: string | null } | null;
            return (
              <li key={row.id} className="panel">
                <div className="row-between">
                  <strong className="eng">{money(Number(row.amount_usd))}</strong>
                  <span className="id-chip">{row.topup_code}</span>
                </div>
                <p style={{ fontSize: '0.86rem' }}>
                  {row.purpose === 'balance'
                    ? <span className="status-pill status-muted">{t('شحن رصيد', 'Balance top-up')}</span>
                    : <span className="status-pill status-ok">💳 {row.purpose_label}</span>}
                </p>
                <p className="muted" style={{ fontSize: '0.84rem' }}>
                  {person?.full_name} <span className="id-chip">{person?.techmood_id}</span> · {row.method_key}
                  {row.reference && <> · <span dir="ltr">{row.reference}</span></>}
                  {row.submitted_at && <> · {time.format(new Date(row.submitted_at))}</>}
                </p>
                {links.get(row.id) && <a className="btn btn-ghost btn-sm" href={links.get(row.id)} target="_blank" rel="noopener noreferrer">🧾 {t('افتح الإيصال', 'Open the receipt')}</a>}
                <TopupReviewForm topupId={row.id} purchase={row.purpose !== 'balance'} />
              </li>
            );
          })}
        </ul>
      )}

      {(recent ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('آخر ما رُوجع', 'Recently reviewed')}</h3>
          <table className="data">
            <tbody>
              {(recent ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="eng">{row.topup_code}</td>
                  <td className="eng">{money(Number(row.amount_usd))}</td>
                  <td style={{ fontSize: '0.82rem' }}>{row.purpose === 'balance' ? t('شحن رصيد', 'Top-up') : row.purpose_label}</td>
                  <td>
                    <span className={`status-pill ${row.status === 'approved' ? 'status-ok' : 'status-danger'}`}>
                      {row.status !== 'approved' ? t('رُفض', 'Turned down')
                        : row.purpose === 'balance' ? t('شُحن', 'Credited')
                        : row.fulfilled_at ? t('اكتمل الشراء', 'Purchase done') : t('في الرصيد — لم يكتمل الشراء', 'In balance — not bought')}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: '0.8rem' }}>{row.reviewed_at ? time.format(new Date(row.reviewed_at)) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
