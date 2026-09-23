import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { money } from '@/lib/booking';
import { PAYOUT_STATUS } from '@/lib/wallet';

import { reviewPayout, startTransfer } from './actions';
import { PayoutProof } from './PayoutProof';

export default async function AdminPayoutsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمشرفين فقط.', 'This page is for admins only.')}</p>;
  }

  const { data: requests } = await supabase
    .from('payout_requests')
    .select('id, request_code, profile_id, account_id, amount_usd, status, note_ar, paid_reference, created_at, reviewed_at, proof_path')
    .order('created_at', { ascending: true });

  const profileIds = [...new Set((requests ?? []).map((row) => row.profile_id))];
  const accountIds = [...new Set((requests ?? []).map((row) => row.account_id))];
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: profiles }, { data: accounts }, { data: methods }, { data: balances }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, techmood_id').in('id', profileIds.length ? profileIds : placeholder),
    supabase.from('payout_accounts').select('*').in('id', accountIds.length ? accountIds : placeholder),
    supabase.from('payment_methods').select('key, name_ar, icon'),
    supabase.from('wallet_balance').select('profile_id, available_usd').in('profile_id', profileIds.length ? profileIds : placeholder),
  ]);

  const profileById = new Map((profiles ?? []).map((row) => [row.id, row]));
  const accountById = new Map((accounts ?? []).map((row) => [row.id, row]));
  const methodByKey = new Map((methods ?? []).map((row) => [row.key, row]));
  const balanceById = new Map((balances ?? []).map((row) => [row.profile_id, row.available_usd]));

  const waiting = (requests ?? []).filter((row) => row.status === 'requested' || row.status === 'approved');
  const settled = (requests ?? []).filter((row) => row.status === 'paid' || row.status === 'rejected');

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('طلبات السحب', 'Payout requests')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/admin">{t('لوحة الإدارة', 'Admin panel')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('المبلغ محجوز من رصيد العضو منذ لحظة الطلب. الاعتماد يثبّت الخصم، والرفض يعيد المبلغ إلى رصيده.',
             'The amount is held against the member\u2019s balance from the moment they ask. Approving makes the deduction final; rejecting puts it back.')}
        </p>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('بانتظار التحويل', 'Awaiting transfer')} ({waiting.length})</h3>

        {waiting.length === 0 ? (
          <p className="notice">{t('لا طلبات سحب بانتظار المراجعة 🎉', 'No payout requests waiting 🎉')}</p>
        ) : (
          waiting.map((request) => {
            const member = profileById.get(request.profile_id);
            const account = accountById.get(request.account_id);
            const method = methodByKey.get(account?.method_key ?? '');

            return (
              <article className="panel section-block" key={request.id}>
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem' }}>
                      {member?.full_name} · <span className="eng">{money(request.amount_usd)}</span>
                    </h3>
                    <span className="id-chip" style={{ marginTop: 6, display: 'inline-block' }}>
                      {member?.techmood_id}
                    </span>
                  </div>
                  <span className="id-chip">{request.request_code}</span>
                </div>

                <div className="summary-rows" style={{ marginTop: 14 }}>
                  <div className="summary-row">
                    <span className="muted">{t('طريقة الاستلام', 'Payout method')}</span>
                    <span>{method?.icon} {method?.name_ar}</span>
                  </div>
                  <div className="summary-row">
                    <span className="muted">{t('صاحب الحساب', 'Account holder')}</span>
                    <span>{account?.holder_name}</span>
                  </div>
                  {account?.wallet_number && (
                    <div className="summary-row">
                      <span className="muted">{t('رقم المحفظة', 'Wallet number')}</span>
                      <span className="eng">{account.wallet_number}</span>
                    </div>
                  )}
                  {account?.account_number && (
                    <div className="summary-row">
                      <span className="muted">{t('رقم الحساب', 'Account number')}</span>
                      <span className="eng">{account.account_number}</span>
                    </div>
                  )}
                  {account?.iban && (
                    <div className="summary-row">
                      <span className="muted">IBAN</span>
                      <span className="eng">{account.iban}</span>
                    </div>
                  )}
                  {account?.swift && (
                    <div className="summary-row">
                      <span className="muted">SWIFT</span>
                      <span className="eng">{account.swift}</span>
                    </div>
                  )}
                  {account?.bank_name && (
                    <div className="summary-row">
                      <span className="muted">{t('البنك', 'Bank')}</span>
                      <span>{account.bank_name}{account.country ? ` — ${account.country}` : ''}</span>
                    </div>
                  )}
                  <div className="summary-row">
                    <span className="muted">{t('رصيده بعد الحجز', 'Balance after the hold')}</span>
                    <span className="eng">{money(balanceById.get(request.profile_id) ?? 0)}</span>
                  </div>
                  <div className="summary-row">
                    <span className="muted">{t('تاريخ الطلب', 'Requested on')}</span>
                    <span className="eng">{new Date(request.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  {request.status === 'requested' ? (
                    <form action={startTransfer}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button className="btn btn-ghost btn-sm">
                        {t('🟠 بدأتُ التحويل', '🟠 I am sending it now')}
                      </button>
                    </form>
                  ) : (
                    <span className="status-pill status-pending">{t('قيد التحويل', 'Transferring')}</span>
                  )}
                  <PayoutProof requestId={request.id} payeeId={request.profile_id} hasProof={Boolean(request.proof_path)} />
                  <a className="btn btn-ghost btn-sm" href={`/wallet/timeline/payout/${request.id}`}>
                    {t('السجلّ', 'Timeline')}
                  </a>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <form action={reviewPayout} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 280 }}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <input name="reference" required placeholder={t('مرجع التحويل', 'Transfer reference')} style={{ flex: 1, minWidth: 0 }} />
                    <button className="btn btn-primary btn-sm">{t('أكّد التحويل', 'Confirm transfer')}</button>
                  </form>
                  <form action={reviewPayout} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 280 }}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input name="note" required placeholder={t('سبب الرفض — يظهر للعضو', 'Why — the member will see this')} style={{ flex: 1, minWidth: 0 }} />
                    <button className="btn btn-ghost btn-sm">{t('رفض', 'Reject')}</button>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>

      {settled.length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('سجلّ السحوبات', 'Payout history')}</h3>
          <table className="data">
            <thead>
              <tr><th>{t('الطلب', 'Request')}</th><th>{t('العضو', 'Member')}</th><th>{t('المبلغ', 'Amount')}</th><th>{t('الحالة', 'Status')}</th><th>{t('مرجع التحويل', 'Reference')}</th><th>{t('تاريخ المراجعة', 'Reviewed')}</th></tr>
            </thead>
            <tbody>
              {settled.map((request) => (
                <tr key={request.id}>
                  <td className="eng">{request.request_code}</td>
                  <td>{profileById.get(request.profile_id)?.full_name}</td>
                  <td className="eng">{money(request.amount_usd)}</td>
                  <td>
                    <span className={`status-pill ${PAYOUT_STATUS[request.status].className}`}>
                      {t(PAYOUT_STATUS[request.status].text)}
                    </span>
                  </td>
                  <td className="eng">{request.paid_reference ?? '—'}</td>
                  <td className="eng">
                    {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString('ar-EG') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
