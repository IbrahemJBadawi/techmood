import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';

import { StartupNav } from '../StartupNav';
import { RoadmapForm } from './RoadmapForm';
import { removeRoadmapItem, setRoadmapStatus, startRoadmapItem } from './actions';

const SOURCE: Record<'item' | 'goal' | 'project', Text> = {
  item:    { ar: 'نيّة',   en: 'Intent' },
  goal:    { ar: 'هدف',    en: 'Goal' },
  project: { ar: 'مشروع',  en: 'Project' },
};

/**
 * The quarters.
 *
 * Three sources on one timeline: what the company intends and has not started,
 * the goals it measured itself against, and the projects it is actually
 * building. Only the first of those is written here — the rest are gathered, so
 * a date can never be true on the roadmap and false everywhere else.
 */
export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase
    .from('startups').select('id, name_ar').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: rows }, { data: canEdit }, { data: items }] = await Promise.all([
    supabase.rpc('roadmap', { p_startup: startupId }),
    supabase.rpc('can_edit_startup', { p_startup: startupId }),
    supabase.from('roadmap_items').select('id, status, project_id').eq('startup_id', startupId),
  ]);

  const itemState = new Map((items ?? []).map((row) => [row.id, row]));
  const timeline = rows ?? [];

  const quarters = [...new Set(timeline.map((row) => `${row.year}-${row.quarter}`))]
    .sort((a, b) => {
      const [yearA, quarterA] = a.split('-').map(Number);
      const [yearB, quarterB] = b.split('-').map(Number);
      return yearA - yearB || quarterA - quarterB;
    });

  const thisYear = new Date().getFullYear();

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — خارطة الطريق', ' — roadmap')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}/share`}>
            {t('شارك أو اطبع', 'Share or print')}
          </Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('ثلاثة مصادر على خط واحد: ما تنوونه ولم يبدأ بعد، والأهداف بمواعيدها، والمشاريع الجارية. البند الذي يبدأ العمل عليه يصبح مشروعاً — فلا يبقى تاريخ صحيحاً هنا وخاطئاً في مكان آخر.',
             'Three sources on one line: what you intend and have not started, the goals with their dates, and the projects under way. An item you start becomes a project — so no date is ever true here and false somewhere else.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      {quarters.length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا شيء على الخارطة بعد', 'Nothing on the roadmap yet')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('اكتب ما تنوون إنجازه هذا الربع والذي يليه.', 'Write what you mean to do this quarter and the next.')}
          </p>
        </div>
      ) : (
        <section className="section-block roadmap-grid">
          {quarters.map((key) => {
            const [year, quarter] = key.split('-').map(Number);
            const entries = timeline.filter((row) => row.year === year && row.quarter === quarter);

            return (
              <article className="panel roadmap-quarter" key={key}>
                <header className="row-between">
                  <strong className="eng">Q{quarter} {year}</strong>
                  <span className="badge-pill eng">{entries.length}</span>
                </header>

                <ul className="plain-list" style={{ marginTop: 10 }}>
                  {entries.map((entry) => {
                    const state = itemState.get(entry.item_id);
                    return (
                      <li key={`${entry.source}-${entry.item_id}`} style={{ fontSize: '0.84rem' }}>
                        <span className={`badge-pill roadmap-source-${entry.source}`}>
                          {t(SOURCE[entry.source])}
                        </span>{' '}
                        {entry.link ? <Link href={entry.link}>{entry.title_ar}</Link> : entry.title_ar}
                        {entry.detail_ar && (
                          <p className="muted" style={{ fontSize: '0.76rem', marginTop: 2 }}>{entry.detail_ar}</p>
                        )}

                        {canEdit === true && entry.source === 'item' && (
                          <span className="row-actions" style={{ marginTop: 6 }}>
                            {!state?.project_id && (
                              <form action={startRoadmapItem}>
                                <input type="hidden" name="startup_id" value={startupId} />
                                <input type="hidden" name="item_id" value={entry.item_id} />
                                <button className="btn btn-ghost btn-sm">{t('ابدأه كمشروع', 'Start it')}</button>
                              </form>
                            )}
                            <form action={setRoadmapStatus}>
                              <input type="hidden" name="startup_id" value={startupId} />
                              <input type="hidden" name="item_id" value={entry.item_id} />
                              <input type="hidden" name="status" value="done" />
                              <button className="btn btn-ghost btn-sm">{t('تمّ', 'Done')}</button>
                            </form>
                            <form action={removeRoadmapItem}>
                              <input type="hidden" name="startup_id" value={startupId} />
                              <input type="hidden" name="item_id" value={entry.item_id} />
                              <button className="btn btn-ghost btn-sm">✕</button>
                            </form>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </section>
      )}

      {canEdit === true && (
        <section className="section-block">
          <h3 className="academy-heading">{t('أضف بنداً', 'Add an item')}</h3>
          <RoadmapForm startupId={startupId} year={thisYear} />
        </section>
      )}
    </>
  );
}
