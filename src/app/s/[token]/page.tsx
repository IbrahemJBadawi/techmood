import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { PLAN_SECTIONS } from '@/lib/incubator';
import type { PlanSection } from '@/lib/database.types';

export const metadata = { title: 'Shared from TechMood' };

type CanvasPayload = {
  blocks: { key: string; title: string; hint: string | null; cards: { body: string; colour: string }[] }[];
};
type PlanPayload = { sections: { section: PlanSection; body: string | null; complete: boolean }[] };
type RoadmapPayload = {
  items: { title: string; detail: string | null; year: number; quarter: number; status: string }[];
};
type ShowcasePayload = {
  problem: string | null; solution: string | null; stage: string;
  projects: { title: string; status: string }[];
};

/**
 * What a share link opens.
 *
 * Whoever holds the link sees this one thing and nothing near it — no
 * workspace, no other canvas, no people, no money. The page is deliberately
 * plain: it is meant to be read, printed, or turned into a PDF from the print
 * dialog, and to say nothing the company did not choose to share.
 */
export default async function SharedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data } = await supabase.rpc('shared_view', { p_token: token });
  const share = data?.[0];

  if (!share) notFound();

  await supabase.rpc('record_share_view', { p_token: token });

  return (
    <main className="public-page share-page">
      <header className="section-block">
        <p className="kicker">{share.label_ar ?? t('مشاركة من TechMood', 'Shared from TechMood')}</p>
        <h1 style={{ fontSize: '1.5rem', marginTop: 6 }}>{share.company_name}</h1>
        {share.one_liner && <p className="muted" style={{ marginTop: 6 }}>{share.one_liner}</p>}
        {share.canvas_title && (
          <p className="muted" style={{ fontSize: '0.88rem', marginTop: 4 }}>{share.canvas_title}</p>
        )}
      </header>

      {share.scope === 'canvas' && (
        <section className="canvas-grid">
          {((share.payload as unknown as CanvasPayload).blocks ?? []).map((block) => (
            <article className="bmc-block" key={block.key}>
              <header><h3>{block.title}</h3></header>
              {block.hint && <p className="bmc-hint">{block.hint}</p>}
              {block.cards.map((card, index) => (
                <div className={`bmc-card card-${card.colour}`} key={index}>{card.body}</div>
              ))}
            </article>
          ))}
        </section>
      )}

      {share.scope === 'plan' && (
        <section className="section-block">
          {((share.payload as unknown as PlanPayload).sections ?? [])
            .filter((section) => section.body)
            .map((section) => (
              <article className="panel section-block" key={section.section}>
                <h2 className="profile-heading">
                  {PLAN_SECTIONS.find((row) => row.key === section.section)?.label.ar ?? section.section}
                </h2>
                <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{section.body}</p>
              </article>
            ))}
        </section>
      )}

      {share.scope === 'roadmap' && (
        <section className="roadmap-grid">
          {((share.payload as unknown as RoadmapPayload).items ?? []).map((item, index) => (
            <article className="panel roadmap-quarter" key={index}>
              <header className="row-between">
                <strong className="eng">Q{item.quarter} {item.year}</strong>
                <span className="badge-pill">{item.status}</span>
              </header>
              <p style={{ fontSize: '0.88rem', marginTop: 8 }}>{item.title}</p>
              {item.detail && <p className="muted" style={{ fontSize: '0.8rem' }}>{item.detail}</p>}
            </article>
          ))}
        </section>
      )}

      {share.scope === 'showcase' && (
        <section className="panel section-block">
          {(share.payload as unknown as ShowcasePayload).problem && (
            <>
              <h2 className="profile-heading">{t('المشكلة', 'The problem')}</h2>
              <p style={{ fontSize: '0.9rem' }}>{(share.payload as unknown as ShowcasePayload).problem}</p>
            </>
          )}
          {(share.payload as unknown as ShowcasePayload).solution && (
            <>
              <h2 className="profile-heading" style={{ marginTop: 16 }}>{t('الحل', 'The solution')}</h2>
              <p style={{ fontSize: '0.9rem' }}>{(share.payload as unknown as ShowcasePayload).solution}</p>
            </>
          )}
          {((share.payload as unknown as ShowcasePayload).projects ?? []).length > 0 && (
            <>
              <h2 className="profile-heading" style={{ marginTop: 16 }}>{t('أعمال منجزة', 'Finished work')}</h2>
              <ul className="profile-list">
                {((share.payload as unknown as ShowcasePayload).projects ?? []).map((project, index) => (
                  <li key={index}><strong>{project.title}</strong></li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <p className="muted no-print" style={{ fontSize: '0.76rem', textAlign: 'center', margin: '24px 0' }}>
        {t('رابط مشاركة من TechMood — يفتح هذا المحتوى وحده، وينتهي في تاريخه.',
           'A TechMood share link — it opens this content alone, and stops working on its date.')}
      </p>
    </main>
  );
}
