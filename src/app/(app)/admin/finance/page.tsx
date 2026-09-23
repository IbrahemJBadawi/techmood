import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';

export const metadata = { title: 'Finance — TechMood' };

const RANGES = ['today', 'month', 'all'] as const;
type Range = (typeof RANGES)[number];

/**
 * The financial picture, with the one distinction that matters kept on screen:
 * what customers paid (GMV) is not TechMood's revenue. TechMood's revenue is
 * its share; what it owes the people who did the work is theirs.
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const params = await searchParams;
  const range: Range = RANGES.includes(params.range as Range) ? (params.range as Range) : 'month';

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = range === 'today' ? iso(today)
    : range === 'month' ? iso(new Date(today.getFullYear(), today.getMonth(), 1))
    : null;

  const { data } = await supabase.rpc('finance_overview', { p_from: from, p_to: iso(today) });
  const f = data?.[0];

  const rangeLabel: Record<Range, string> = {
    today: t('اليوم', 'Today'),
    month: t('هذا الشهر', 'This month'),
    all: t('منذ البداية', 'All time'),
  };

  return (
    <>
      <section className="section-block">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>💰 {t('الصورة المالية', 'Financial overview')}</h2>
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '66ch' }}>
              {t('ما دفعه العملاء ليس إيراد TechMood. الإيراد حصّة المنصّة وحدها، وما تبقّى مستحق لمن نفّذ العمل.',
                 'What customers paid is not TechMood’s revenue. Revenue is the platform’s share alone; the rest is owed to whoever did the work.')}
            </p>
          </div>
          <div className="row-actions">
            <Link className="btn btn-ghost btn-sm" href="/admin/finance/accounts">{t('حسابات الاستلام', 'Receiving accounts')}</Link>
          </div>
        </div>

        <nav className="tabs" style={{ marginTop: 14 }}>
          {RANGES.map((key) => (
            <Link key={key} href={`/admin/finance?range=${key}`} className={`tab${range === key ? ' is-on' : ''}`}>
              {rangeLabel[key]}
            </Link>
          ))}
        </nav>

        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{money(f?.gmv_usd ?? 0)}</div>
            <div className="lbl">{t('ما دفعه العملاء (GMV)', 'Customers paid (GMV)')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(f?.platform_revenue_usd ?? 0)}</div>
            <div className="lbl">{t('إيراد TechMood', 'TechMood revenue')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(f?.user_earnings_usd ?? 0)}</div>
            <div className="lbl">{t('مستحقات المستخدمين', 'User earnings')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(f?.refunded_usd ?? 0)}</div>
            <div className="lbl">{t('المسترد', 'Refunded')}</div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem' }}>{t('الآن', 'Right now')}</h3>
        <div className="stat-tiles" style={{ marginTop: 10 }}>
          <div className="stat-tile">
            <div className="val eng">{money(f?.held_in_escrow_usd ?? 0)}</div>
            <div className="lbl">{t('محجوز لأعمال السوق', 'Held for market work')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(f?.owed_to_users_usd ?? 0)}</div>
            <div className="lbl">{t('متاح للسحب لدى المستخدمين', 'Available to users to withdraw')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(f?.pending_withdrawals_usd ?? 0)}</div>
            <div className="lbl">{t('سحوبات قيد التنفيذ', 'Withdrawals in progress')}</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{money(f?.pending_verification_usd ?? 0)}</div>
            <div className="lbl">{t('مدفوعات بانتظار التأكيد', 'Payments awaiting confirmation')}</div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem' }}>{t('يحتاج إجراء', 'Needs action')}</h3>
        <ul className="plain-list" style={{ marginTop: 10 }}>
          <li>
            🔴 <Link href="/admin/payments">{t('مدفوعات بانتظار التأكيد', 'Payments to confirm')}</Link>
            <span className="eng"> · {f?.pending_verification ?? 0}</span>
            {(f?.needs_info ?? 0) > 0 && (
              <span className="muted"> ({t(`${f?.needs_info} بانتظار جواب الدافع`, `${f?.needs_info} waiting on the payer`)})</span>
            )}
          </li>
          <li>
            🟠 <Link href="/admin/payouts">{t('طلبات سحب', 'Withdrawal requests')}</Link>
            <span className="eng"> · {f?.pending_withdrawals ?? 0}</span>
          </li>
          <li>
            🟡 <Link href="/admin/escrows">{t('نزاعات على مبالغ محجوزة', 'Disputed holds')}</Link>
            <span className="eng"> · {f?.disputes ?? 0}</span>
          </li>
        </ul>
      </section>
    </>
  );
}
