import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { PayToDetails } from '@/components/PayToDetails';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { money } from '@/lib/booking';

import { cancelTopup } from '../../credit-actions';
import { TopupProofForm } from './TopupProofForm';

export const generateMetadata = localizedTitle('شحن الرصيد — TechMood', 'Top-up — TechMood');

/** One top-up: where to send it, the receipt, and where it stands. */
export default async function TopupDetailPage({ params }: { params: Promise<{ topupId: string }> }) {
  const t = await getT();
  const { topupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: topup } = await supabase.from('credit_topups')
    .select('id, topup_code, amount_usd, status, rejection_reason, profile_id').eq('id', topupId).maybeSingle();
  if (!topup || topup.profile_id !== user.id) notFound();
  const { data: rows } = await supabase.rpc('topup_instructions', { p_topup: topupId });
  const payTo = rows?.[0] ?? null;
  const open = topup.status === 'pending' || topup.status === 'rejected';

  return (
    <>
      <BackLink href="/wallet" label={t('المحفظة', 'Wallet')} />
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t(`شحن ${money(Number(topup.amount_usd))}`, `Top up ${money(Number(topup.amount_usd))}`)}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 4 }}><span className="id-chip">{topup.topup_code}</span></p>
      </section>

      {topup.status === 'under_review' && <p className="notice section-block">{t('⏳ وصل الإيصال وهو قيد المراجعة. يُشحن رصيدك فور التحقق، ويصلك إشعار.', '⏳ Your receipt is being checked. Your balance is topped up as soon as it is verified.')}</p>}
      {topup.status === 'approved' && <p className="notice notice-ok section-block">{t('✓ شُحن رصيدك بهذا المبلغ.', '✓ This amount is in your balance.')}</p>}
      {topup.status === 'cancelled' && <p className="notice section-block">{t('أُلغي هذا الطلب.', 'This request was cancelled.')}</p>}
      {topup.status === 'rejected' && (
        <p className="notice notice-danger section-block">
          <strong>{t('لم يُقبل الإيصال:', 'The receipt was not accepted:')}</strong> {topup.rejection_reason} — {t('ارفع إيصالاً جديداً.', 'upload a new one.')}
        </p>
      )}

      {open && payTo && (
        <div className="detail-grid">
          <div className="panel"><PayToDetails payTo={payTo} /></div>
          <TopupProofForm topupId={topup.id} userId={user.id} requiresReceipt={payTo.requires_receipt}
                          requiresReference={payTo.requires_reference} referenceLabel={payTo.reference_label_ar} />
        </div>
      )}

      {open && (
        <form action={cancelTopup} className="section-block">
          <input type="hidden" name="topup_id" value={topup.id} />
          <button className="btn btn-ghost btn-sm">{t('ألغِ طلب الشحن', 'Cancel this top-up')}</button>
        </form>
      )}
    </>
  );
}
