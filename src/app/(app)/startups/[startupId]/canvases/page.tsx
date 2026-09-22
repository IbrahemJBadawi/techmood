import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { CANVAS_KIND } from '@/lib/incubator';
import type { CanvasKind } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { NewCanvasForm } from './NewCanvasForm';

/**
 * The studio: every wall this company thinks on.
 *
 * They are the same object with different blocks — which is why there is one
 * editor behind all of them, and why adding a kind is a row in a template table
 * rather than a new screen.
 */
export default async function CanvasesPage({
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

  const [{ data: canvases }, { data: canEdit }, { data: cards }] = await Promise.all([
    supabase.from('canvases')
      .select('id, kind, title_ar, summary_ar, visibility, updated_at')
      .eq('startup_id', startupId)
      .order('created_at'),
    supabase.rpc('can_edit_startup', { p_startup: startupId }),
    supabase.from('canvas_cards').select('canvas_id').eq('startup_id', startupId),
  ]);

  const countOf = new Map<string, number>();
  for (const card of cards ?? []) {
    if (card.canvas_id) countOf.set(card.canvas_id, (countOf.get(card.canvas_id) ?? 0) + 1);
  }

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — اللوحات', ' — canvases')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('كل لوحة هنا طريقة تفكير: نموذج العمل يرسم الصورة كاملة، وLean يبدأ من المشكلة، والقيمة المقترحة تقارن ما يحتاجه العميل بما تقدّمه. البطاقة على أي لوحة يمكن أن تصبح هدفاً أو مشروعاً — وهذا هو المقصد.',
             'Each canvas here is a way of thinking: the business model draws the whole picture, lean starts from the problem, the value proposition weighs what a customer needs against what you offer. A card on any of them can become a goal or a project — which is the point.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      {(canvases ?? []).length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا لوحات بعد', 'No canvases yet')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('ابدأ بنموذج العمل، أو بـLean إن كانت الفكرة ما زالت مبكرة.',
               'Start with the business model, or with lean if the idea is still early.')}
          </p>
        </div>
      ) : (
        <div className="market-grid section-block">
          {(canvases ?? []).map((canvas) => (
            <Link className="panel talent-card" key={canvas.id}
                  href={`/startups/${startupId}/canvases/${canvas.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row-between">
                <span className="kicker">{t(CANVAS_KIND[canvas.kind as CanvasKind].label)}</span>
                <span className="badge-pill eng">{countOf.get(canvas.id) ?? 0}</span>
              </div>
              <h3 style={{ fontSize: '0.98rem', marginTop: 6 }}>{canvas.title_ar}</h3>
              <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                {canvas.summary_ar ?? t(CANVAS_KIND[canvas.kind as CanvasKind].hint)}
              </p>
              {canvas.visibility === 'public' && (
                <span className="badge-pill" style={{ marginTop: 10 }}>{t('معروضة للعامة', 'Public')}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {canEdit === true && <NewCanvasForm startupId={startupId} />}
    </>
  );
}
