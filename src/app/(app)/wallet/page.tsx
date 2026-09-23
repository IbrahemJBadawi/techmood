import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { money } from '@/lib/booking';
import { PAYOUT_STATUS, TRANSACTION_FILTERS, signedMoney } from '@/lib/wallet';
import type { PayoutAccount } from '@/lib/database.types';

import { PayoutPanel } from './PayoutPanel';

export const metadata = { title: 'Wallet — TechMood' };

const TABS = ['overview', 'transactions', 'payments', 'earnings', 'withdrawals', 'methods'] as const;
type Tab = (typeof TABS)[number];

/** A status a person can read, for anything the statement lists. */
const STATUS_LABEL: Record<string, { ar: string; en: string; tone: string }> = {
  pending:      { ar: 'لم يُرسل بعد',          en: 'Not sent yet',   tone: 'status-muted' },
  under_review: { ar: 'بانتظار تأكيد TechMood', en: 'Being checked',  tone: 'status-pending' },
  needs_info:   { ar: 'سؤال بانتظارك',          en: 'A question for you', tone: 'status-pending' },
  verified:     { ar: 'تمّ الاستلام',           en: 'Received',       tone: 'status-ok' },
  rejected:     { ar: 'لم يُقبل',               en: 'Not accepted',   tone: 'status-danger' },
  refunded:     { ar: 'مُسترد',                 en: 'Refunded',       tone: 'status-muted' },
  failed:       { ar: 'فشل',                    en: 'Failed',         tone: 'status-danger' },
  available:    { ar: 'متاح',                   en: 'Available',      tone: 'status-ok' },
  paid:         { ar: 'مدفوع',                  en: 'Paid out',       tone: 'status-muted' },
  cancelled:    { ar: 'ملغى',                   en: 'Cancelled',      tone: 'status-muted' },
  requested:    { ar: 'بانتظار المراجعة',       en: 'Awaiting review', tone: 'status-pending' },
  approved:     { ar: 'قيد التحويل',            en: 'Transferring',   tone: 'status-pending' },
};

/**
 * One wallet, whose contents follow what a person does here.
 *
 * It is a financial record, not money held: what a person paid, what became
 * owed to them, what was transferred, and what is still being checked. A
 * learner who only pays has no "balance" worth showing, so the payer's half
 * and the earner's half are separate cards, and a person sees the halves that
 * have something in them.
 */
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'overview';
  const filter = TRANSACTION_FILTERS.some((f) => f.key === params.filter) ? params.filter! : 'all';

  const listFilter =
    tab === 'payments' ? 'payments'
    : tab === 'earnings' ? 'income'
    : tab === 'withdrawals' ? 'withdrawals'
    : tab === 'transactions' ? filter
    : 'all';

  const [{ data: overviewRows }, { data: transactions }, { data: accounts }, { data: requests }, { data: methods }, { data: minimum }] =
    await Promise.all([
      supabase.rpc('wallet_overview'),
      supabase.rpc('wallet_transactions', { p_filter: listFilter, p_limit: tab === 'overview' ? 8 : 200 }),
      supabase.from('payout_accounts').select('*').eq('profile_id', user.id).order('created_at'),
      supabase
        .from('payout_requests')
        .select('id, request_code, amount_usd, status, note_ar, paid_reference, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('payment_methods').select('key, name_ar, icon').eq('supports_payout', true).order('sort_order'),
      supabase.from('platform_settings').select('value').eq('key', 'payout_minimum_usd').maybeSingle(),
    ]);

  const o = overviewRows?.[0];
  const pays = (o?.paid_usd ?? 0) > 0 || (o?.under_review_usd ?? 0) > 0 || (o?.open_payments ?? 0) > 0;
  const earns = (o?.total_earned_usd ?? 0) > 0 || (o?.pending_usd ?? 0) > 0 || (o?.withdrawn_usd ?? 0) > 0;
  const minimumUsd = Number(minimum?.value ?? 20);
  const available = Number(o?.available_usd ?? 0);

  const tabLabel: Record<Tab, string> = {
    overview: t('نظرة عامة', 'Overview'),
    transactions: t('المعاملات', 'Transactions'),
    payments: t('المدفوعات', 'Payments'),
    earnings: t('الأرباح', 'Earnings'),
    withdrawals: t('السحوبات', 'Withdrawals'),
    methods: t('حسابات الاستلام', 'Payout methods'),
  };

  const statement = (rows: typeof transactions) => (
    (rows ?? []).length === 0 ? (
      <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا شيء هنا بعد.', 'Nothing here yet.')}</p>
    ) : (
      <ul className="wallet-statement">
        {(rows ?? []).map((row) => {
          const status = STATUS_LABEL[row.status];
          const timeline = row.entity_type === 'payment' || row.entity_type === 'payout'
            ? `/wallet/timeline/${row.entity_type}/${row.entity_id}` : null;
          return (
            <li key={`${row.entity_type}-${row.entity_id}-${row.at}`}
                className={row.status === 'cancelled' ? 'is-cancelled' : ''}>
              <span className={`eng wallet-amount ${Number(row.amount_usd) < 0 ? 'is-out' : 'is-in'}`}>
                {signedMoney(Number(row.amount_usd))}
              </span>
              <span className="wallet-label">
                {row.label_ar}
                {row.code && <span className="id-chip" style={{ marginInlineStart: 6 }}>{row.code}</span>}
                <span className="muted eng" style={{ display: 'block', fontSize: '0.76rem' }}>
                  {formatDateTime(locale, row.at)}
                </span>
              </span>
              <span className={`status-pill ${status?.tone ?? 'status-muted'}`}>
                {status ? t(status.ar, status.en) : row.status}
              </span>
              {timeline && (
                <Link className="btn btn-ghost btn-sm" href={timeline}>{t('السجلّ', 'Timeline')}</Link>
              )}
            </li>
          );
        })}
      </ul>
    )
  );

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>💰 {t('المحفظة', 'Wallet')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('سجلّ مالي، لا مال محفوظ: ما دفعته، وما أصبح مستحقاً لك، وما حُوّل إليك، وما زال قيد المراجعة. كل رقم هنا محسوب من السجلّ نفسه.',
             'A financial record, not money held: what you paid, what became owed to you, what was sent to you, and what is still being checked. Every figure is computed from the record itself.')}
        </p>
      </section>

      <nav className="tabs" aria-label={t('أقسام المحفظة', 'Wallet sections')}>
        {TABS.map((key) => (
          <Link key={key} href={`/wallet?tab=${key}`} className={`tab${tab === key ? ' is-on' : ''}`}>
            {tabLabel[key]}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          {earns && (
            <section className="section-block">
              <div className="wallet-hero">
                <div>
                  <div className="lbl">{t('متاح للسحب', 'Available to withdraw')}</div>
                  <div className="val eng" style={available < 0 ? { color: 'var(--danger)' } : undefined}>
                    {money(available)}
                  </div>
                </div>
                <Link className="btn btn-primary" href="/wallet?tab=withdrawals">
                  {t('سحب المستحقات', 'Withdraw')}
                </Link>
              </div>
              <div className="stat-tiles" style={{ marginTop: 12 }}>
                <div className="stat-tile">
                  <div className="val eng">{money(o?.pending_usd ?? 0)}</div>
                  <div className="lbl">{t('مستحقات قيد الانتظار', 'Pending earnings')}</div>
                </div>
                <div className="stat-tile">
                  <div className="val eng">{money(o?.withdrawal_pending_usd ?? 0)}</div>
                  <div className="lbl">{t('سحب قيد التنفيذ', 'Withdrawal in progress')}</div>
                </div>
                <div className="stat-tile">
                  <div className="val eng">{money(o?.withdrawn_usd ?? 0)}</div>
                  <div className="lbl">{t('تمّ سحبه', 'Withdrawn')}</div>
                </div>
                <div className="stat-tile">
                  <div className="val eng">{money(o?.total_earned_usd ?? 0)}</div>
                  <div className="lbl">{t('إجمالي الأرباح', 'Total earned')}</div>
                </div>
              </div>
              {available < 0 && (
                <p className="notice notice-danger" style={{ marginTop: 12 }}>
                  {t('رصيدك بالسالب لأن مبلغاً سُحب عن جلسة استُردت لاحقاً. تواصل مع الإدارة لتسوية الفرق.',
                     'Your balance is negative because an amount was paid out for a session that was later refunded. Contact the team to settle the difference.')}
                </p>
              )}
            </section>
          )}

          {(pays || !earns) && (
            <section className="section-block">
              <h3 style={{ fontSize: '1rem' }}>{t('سجلّ المدفوعات', 'Payment history')}</h3>
              <div className="stat-tiles" style={{ marginTop: 10 }}>
                <div className="stat-tile">
                  <div className="val eng">{money(o?.paid_usd ?? 0)}</div>
                  <div className="lbl">💳 {t('المدفوع', 'Paid')}</div>
                </div>
                <div className="stat-tile">
                  <div className="val eng">{money(o?.under_review_usd ?? 0)}</div>
                  <div className="lbl">⏳ {t('قيد المراجعة', 'Being checked')}</div>
                </div>
                <div className="stat-tile">
                  <div className="val eng">{money(o?.refunded_usd ?? 0)}</div>
                  <div className="lbl">↩️ {t('المسترد', 'Refunded')}</div>
                </div>
                <div className="stat-tile">
                  <div className="val eng">{money(Number(o?.paid_usd ?? 0) - Number(o?.refunded_usd ?? 0))}</div>
                  <div className="lbl">📊 {t('إجمالي الإنفاق', 'Total spent')}</div>
                </div>
              </div>
            </section>
          )}

          <section className="section-block">
            <div className="row-between">
              <h3 style={{ fontSize: '1rem' }}>{t('آخر الحركات', 'Recent movements')}</h3>
              <Link className="btn btn-ghost btn-sm" href="/wallet?tab=transactions">
                {t('كل المعاملات', 'All transactions')}
              </Link>
            </div>
            <div style={{ marginTop: 10 }}>{statement(transactions)}</div>
          </section>
        </>
      )}

      {tab === 'transactions' && (
        <section className="section-block">
          <div className="tags-row" style={{ marginBottom: 12 }}>
            {TRANSACTION_FILTERS.map((f) => (
              <Link key={f.key} href={`/wallet?tab=transactions&filter=${f.key}`}
                    className={`chip${filter === f.key ? ' is-active' : ''}`}>
                {t(f.label)}
              </Link>
            ))}
          </div>
          {statement(transactions)}
        </section>
      )}

      {(tab === 'payments' || tab === 'earnings') && (
        <section className="section-block">{statement(transactions)}</section>
      )}

      {tab === 'withdrawals' && (
        <div className="detail-grid">
          <section>
            {(requests ?? []).length === 0 ? (
              <p className="muted">{t('لم تطلب سحباً بعد.', 'No withdrawals yet.')}</p>
            ) : (
              <ul className="wallet-statement">
                {(requests ?? []).map((request) => (
                  <li key={request.id}>
                    <span className="eng wallet-amount is-out">{signedMoney(-Number(request.amount_usd))}</span>
                    <span className="wallet-label">
                      <span className="id-chip">{request.request_code}</span>
                      {request.paid_reference && (
                        <span className="muted eng" style={{ display: 'block', fontSize: '0.76rem' }}>
                          {t('مرجع التحويل: ', 'Reference: ')}{request.paid_reference}
                        </span>
                      )}
                      {request.note_ar && (
                        <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>{request.note_ar}</span>
                      )}
                    </span>
                    <span className={`status-pill ${PAYOUT_STATUS[request.status].className}`}>
                      {t(PAYOUT_STATUS[request.status].text)}
                    </span>
                    <Link className="btn btn-ghost btn-sm" href={`/wallet/timeline/payout/${request.id}`}>
                      {t('السجلّ', 'Timeline')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <aside>
            <PayoutPanel
              accounts={(accounts ?? []) as PayoutAccount[]}
              methods={(methods ?? []) as { key: string; name_ar: string; icon: string | null }[]}
              available={available}
              minimum={minimumUsd}
            />
          </aside>
        </div>
      )}

      {tab === 'methods' && (
        <section className="section-block" style={{ maxWidth: 560 }}>
          <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 12 }}>
            {t('الحسابات التي تُحوَّل إليها مستحقاتك. تُعرض لك وللإدارة فقط.',
               'The accounts your earnings are sent to. Shown to you and to TechMood only.')}
          </p>
          <PayoutPanel
            accounts={(accounts ?? []) as PayoutAccount[]}
            methods={(methods ?? []) as { key: string; name_ar: string; icon: string | null }[]}
            available={available}
            minimum={minimumUsd}
          />
        </section>
      )}
    </>
  );
}
