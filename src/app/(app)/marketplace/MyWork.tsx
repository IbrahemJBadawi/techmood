import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate, type Text } from '@/lib/i18n';
import { APPLICATION_STAGE } from '@/lib/marketplace';
import type { ApplicationStage, MarketBucket } from '@/lib/database.types';

import { InviteAnswer } from './InviteAnswer';

const BUCKET: Record<MarketBucket, Text> = {
  application: { ar: 'طلباتي',        en: 'My applications' },
  invite:      { ar: 'دعوات وصلتني',  en: 'Invitations' },
  work:        { ar: 'أعمال جارية',   en: 'Work' },
  saved:       { ar: 'محفوظات',       en: 'Saved' },
};

const WORK_STATE: Record<string, Text> = {
  planning:    { ar: 'تخطيط',   en: 'Planning' },
  in_progress: { ar: 'جارٍ',     en: 'In progress' },
  in_review:   { ar: 'مراجعة',  en: 'In review' },
  completed:   { ar: 'مكتمل',   en: 'Completed' },
  archived:    { ar: 'مؤرشف',   en: 'Archived' },
};

/**
 * One person's side of the market: what they asked for, what was asked of
 * them, what they are building, and what they kept. All four come from one
 * read, because they are one question — where does my work stand?
 */
export async function MyWork({ only }: { only?: MarketBucket }) {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc('my_market');
  const items = (rows ?? []).filter((row) => !only || row.bucket === only);

  if (items.length === 0) {
    return (
      <div className="panel empty-state">
        <h3 style={{ fontSize: '0.98rem' }}>{t('لا شيء هنا بعد', 'Nothing here yet')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          {t('تقدّم على فرصة، أو احفظ ما يهمّك للعودة إليه.',
             'Apply for something, or save what interests you to come back to.')}
        </p>
        <Link className="btn btn-primary btn-sm" href="/marketplace?tab=jobs">{t('تصفّح الفرص', 'Browse openings')}</Link>
      </div>
    );
  }

  const buckets: MarketBucket[] = only ? [only] : ['invite', 'application', 'work', 'saved'];

  return (
    <>
      {buckets.map((bucket) => {
        const group = items.filter((row) => row.bucket === bucket);
        if (group.length === 0) return null;

        return (
          <section className="section-block" key={bucket}>
            <h3 className="academy-heading">{t(BUCKET[bucket])}</h3>
            <div className="stack">
              {group.map((row) => (
                <article className="panel session-row" key={`${row.bucket}-${row.item_id}`}>
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: '0.94rem' }}>{row.title_ar ?? '—'}</h4>
                    {row.detail_ar && (
                      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 3 }}>{row.detail_ar}</p>
                    )}
                    <p className="muted" style={{ fontSize: '0.76rem', marginTop: 3 }}>
                      {formatDate(locale, row.at)}
                    </p>
                  </div>

                  <div className="session-row-actions">
                    {row.bucket === 'application' && (
                      <span className={`status-pill ${APPLICATION_STAGE[row.state as ApplicationStage].className}`}>
                        {t(APPLICATION_STAGE[row.state as ApplicationStage].text)}
                      </span>
                    )}
                    {row.bucket === 'work' && (
                      <span className="status-pill status-muted">
                        {t(WORK_STATE[row.state] ?? { ar: row.state, en: row.state })}
                      </span>
                    )}
                    {row.bucket === 'invite' && row.state === 'sent' && (
                      <InviteAnswer inviteId={row.item_id} />
                    )}
                    {row.bucket === 'invite' && row.state !== 'sent' && (
                      <span className="status-pill status-muted">
                        {row.state === 'accepted' ? t('قبلتها', 'Accepted') : t('اعتذرت', 'Declined')}
                      </span>
                    )}
                    <Link className="btn btn-ghost btn-sm" href={row.link}>{t('افتح', 'Open')}</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
