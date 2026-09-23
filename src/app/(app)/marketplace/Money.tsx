import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { money } from '@/lib/booking';

import { ESCROW_STATUS, EscrowProofForm } from '../projects/[projectId]/Money';
import { escrowPayTo, type EscrowPayTo } from '@/lib/escrow-instructions';

/**
 * Every hold this person is on either side of. It is not a wallet — the wallet
 * shows what they have; this shows what is waiting, and on what.
 */
export async function MoneyTab() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: rows } = await supabase.rpc('my_escrows');
  const escrows = rows ?? [];

  const payTo = new Map<string, EscrowPayTo>();
  for (const escrow of escrows.filter((row) => row.status === 'awaiting_payment' && row.side === 'paying')) {
    const found = await escrowPayTo(supabase, escrow.id);
    if (found) payTo.set(escrow.id, found);
  }

  if (escrows.length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا مبالغ محتجزة', 'Nothing held')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('عندما تدفع مقابل عمل أو يُدفع لك، يظهر المبلغ هنا حتى يُفرج عنه.',
             'When you pay for work or are paid for it, the amount sits here until it is released.')}
        </p>
        <Link className="btn btn-ghost btn-sm" href="/wallet">{t('المحفظة', 'Wallet')}</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      {escrows.map((escrow) => (
        <article className="panel session-row" key={escrow.id}>
          <div style={{ minWidth: 0 }}>
            <div className="row-between" style={{ gap: 10 }}>
              <span className="id-chip">{escrow.escrow_code}</span>
              <span className={`status-pill ${ESCROW_STATUS[escrow.status].className}`}>
                {t(ESCROW_STATUS[escrow.status].text)}
              </span>
            </div>
            <h4 style={{ fontSize: '0.92rem', marginTop: 8 }}>
              {escrow.project_title ?? t('عمل عبر السوق', 'Market work')}
            </h4>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 3 }}>
              {escrow.side === 'paying' ? t('تدفع إلى ', 'You are paying ') : t('يدفع لك ', 'You are being paid by ')}
              {escrow.counterpart ?? '—'} · {formatDate(locale, escrow.created_at)}
            </p>
            {escrow.status === 'awaiting_payment' && escrow.side === 'paying' && (
              <div style={{ marginTop: 10 }}>
                <EscrowProofForm escrowId={escrow.id} revalidate="/marketplace?tab=money"
                                 userId={user?.id ?? ''} instructions={payTo.get(escrow.id) ?? null} />
              </div>
            )}
          </div>

          <div className="opp-side">
            <span className="eng" style={{ fontWeight: 700 }}>{money(escrow.amount_usd)}</span>
            <span className="muted eng" style={{ fontSize: '0.76rem' }}>
              {escrow.side === 'earning'
                ? `${t('صافي', 'net')} ${money(escrow.net_usd)}`
                : `${t('عمولة', 'commission')} ${money(escrow.commission_usd)}`}
            </span>
            {escrow.project_id && (
              <Link className="btn btn-ghost btn-sm" href={`/projects/${escrow.project_id}`}>
                {t('العمل', 'The work')}
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
