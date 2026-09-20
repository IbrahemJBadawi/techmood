import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/booking';
import { LEDGER_KIND, LEDGER_STATUS, PAYOUT_STATUS, signedMoney } from '@/lib/wallet';
import type { PayoutAccount } from '@/lib/database.types';

import { PayoutPanel } from './PayoutPanel';

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: balance }, { data: entries }, { data: accounts }, { data: requests }, { data: methods }, { data: minimum }] =
    await Promise.all([
      supabase.from('wallet_balance').select('*').eq('profile_id', user.id).maybeSingle(),
      supabase
        .from('wallet_entries')
        .select('id, kind, amount_usd, status, description_ar, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('payout_accounts').select('*').eq('profile_id', user.id).order('created_at'),
      supabase
        .from('payout_requests')
        .select('id, request_code, amount_usd, status, note_ar, paid_reference, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('payment_methods').select('key, name_ar, icon').eq('supports_payout', true).order('sort_order'),
      supabase.from('platform_settings').select('value').eq('key', 'payout_minimum_usd').maybeSingle(),
    ]);

  const available = balance?.available_usd ?? 0;
  const minimumUsd = Number(minimum?.value ?? 20);

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>المحفظة</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          سجل كامل لكل حركة على رصيدك. الرصيد محسوب من السجل نفسه، لا من رقم محفوظ في مكان آخر.
        </p>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng" style={available < 0 ? { color: 'var(--danger)' } : undefined}>
              {money(available)}
            </div>
            <div className="lbl">الرصيد المتاح</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(balance?.pending_usd ?? 0)}</div>
            <div className="lbl">قيد الانتظار</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(balance?.total_earned_usd ?? 0)}</div>
            <div className="lbl">إجمالي الأرباح</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(balance?.total_paid_out_usd ?? 0)}</div>
            <div className="lbl">إجمالي المسحوب</div>
          </div>
        </div>

        {available < 0 && (
          <p className="notice notice-danger" style={{ marginTop: 14 }}>
            رصيدك بالسالب لأن مبلغاً سُحب عن جلسة استُردت لاحقاً. تواصل مع الإدارة لتسوية الفرق.
          </p>
        )}
      </section>

      <div className="detail-grid">
        <section className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>سجل الحركات</h3>

          {(entries?.length ?? 0) === 0 ? (
            <p className="muted" style={{ fontSize: '0.86rem' }}>
              لا حركات بعد. أرباح الإرشاد تُضاف هنا بعد اكتمال كل جلسة.
            </p>
          ) : (
            <table className="data">
              <thead>
                <tr><th>التاريخ</th><th>الوصف</th><th>النوع</th><th>المبلغ</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {entries!.map((entry) => (
                  <tr key={entry.id} style={entry.status === 'cancelled' ? { opacity: 0.55 } : undefined}>
                    <td className="eng">{new Date(entry.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>{entry.description_ar}</td>
                    <td>{LEDGER_KIND[entry.kind]}</td>
                    <td
                      className="eng"
                      style={{ fontWeight: 600, color: entry.amount_usd < 0 ? 'var(--danger)' : 'var(--ok)' }}
                    >
                      {signedMoney(entry.amount_usd)}
                    </td>
                    <td>
                      <span className={`status-pill ${LEDGER_STATUS[entry.status].className}`}>
                        {LEDGER_STATUS[entry.status].text}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside>
          <PayoutPanel
            accounts={(accounts ?? []) as PayoutAccount[]}
            methods={(methods ?? []) as { key: string; name_ar: string; icon: string | null }[]}
            available={available}
            minimum={minimumUsd}
          />

          {(requests?.length ?? 0) > 0 && (
            <div className="panel" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>طلبات السحب</h3>
              {requests!.map((request) => (
                <div
                  key={request.id}
                  style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--line)' }}
                >
                  <div className="row-between">
                    <span className="eng" style={{ fontWeight: 600 }}>{money(request.amount_usd)}</span>
                    <span className={`status-pill ${PAYOUT_STATUS[request.status].className}`}>
                      {PAYOUT_STATUS[request.status].text}
                    </span>
                  </div>
                  <span className="id-chip" style={{ marginTop: 6, display: 'inline-block' }}>
                    {request.request_code}
                  </span>
                  {request.note_ar && (
                    <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>{request.note_ar}</p>
                  )}
                  {request.paid_reference && (
                    <p className="muted eng" style={{ fontSize: '0.76rem', marginTop: 4 }}>
                      مرجع التحويل: {request.paid_reference}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
