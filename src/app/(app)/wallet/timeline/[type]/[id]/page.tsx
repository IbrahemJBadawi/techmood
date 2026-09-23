import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { FINANCE_EVENT } from '@/lib/wallet';
import type { FinanceEntity } from '@/lib/database.types';

export const metadata = { title: 'Timeline — TechMood' };

const ENTITIES: FinanceEntity[] = ['payment', 'payout', 'escrow'];

/**
 * The whole story of one payment, withdrawal or hold, as the database wrote it
 * down. Every line comes from a trigger on the status column, so no code path
 * can move money without leaving one — which is what makes this worth showing
 * to both sides of a disagreement.
 */
export default async function TimelinePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const { type, id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!ENTITIES.includes(type as FinanceEntity)) notFound();

  const { data: rows } = await supabase.rpc('finance_timeline', {
    p_type: type as FinanceEntity,
    p_id: id,
  });

  // Nothing comes back for somebody who is not a party to it — the same answer
  // as for something that does not exist, on purpose.
  if (!rows || rows.length === 0) notFound();

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/wallet?tab=transactions">
        {t('→ المعاملات', '← Transactions')}
      </Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.15rem' }}>{t('سجلّ العملية', 'What happened, in order')}</h2>
        <ol className="finance-timeline">
          {rows.map((row, index) => {
            const known = FINANCE_EVENT[row.event_key];
            return (
              <li key={`${row.event_key}-${index}`}>
                <span className="finance-dot" aria-hidden>{known?.dot ?? '•'}</span>
                <div>
                  <strong>{known ? t(known.label) : row.event_key.replace(/^booking:/, '')}</strong>
                  <div className="muted eng" style={{ fontSize: '0.78rem' }}>
                    {formatDateTime(locale, row.at)}
                    {row.actor_name && (
                      <> · {row.actor_is_admin ? t('بواسطة إدارة TechMood', 'by TechMood') : row.actor_name}</>
                    )}
                  </div>
                  {row.note_ar && <p style={{ fontSize: '0.84rem', marginTop: 4 }}>{row.note_ar}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
