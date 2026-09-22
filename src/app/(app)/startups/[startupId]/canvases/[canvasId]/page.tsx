import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { CANVAS_KIND } from '@/lib/incubator';
import type { CanvasCard, CanvasKind } from '@/lib/database.types';

import { StartupNav } from '../../StartupNav';
import { CanvasBoard, type Block } from '../CanvasBoard';
import { CardDoors } from './CardDoors';
import { restoreVersion, setCanvasVisibility, snapshotCanvas } from '../actions';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';

/**
 * One wall: its blocks, its cards, its history, and the doors out of it.
 *
 * Nothing on this page is decoration. The version list exists so a strategy can
 * be revisited without courage, and the doors exist because a card that never
 * becomes work is a card that was never worth writing.
 */
export default async function CanvasPage({
  params,
}: {
  params: Promise<{ startupId: string; canvasId: string }>;
}) {
  const { startupId, canvasId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: canvas } = await supabase
    .from('canvases')
    .select('id, startup_id, kind, title_ar, summary_ar, visibility')
    .eq('id', canvasId)
    .maybeSingle();

  if (!canvas || canvas.startup_id !== startupId) notFound();

  const [{ data: blocks }, { data: cards }, { data: canEdit }, { data: versions }, { data: links }] =
    await Promise.all([
      supabase.from('canvas_blocks').select('key, title_ar, hint_ar, sort_order')
        .eq('canvas_id', canvasId).order('sort_order'),
      supabase.from('canvas_cards').select('*').eq('canvas_id', canvasId).order('sort_order'),
      supabase.rpc('can_edit_startup', { p_startup: startupId }),
      supabase.from('canvas_versions').select('id, version, note_ar, created_at')
        .eq('canvas_id', canvasId).order('version', { ascending: false }),
      supabase.from('canvas_card_links').select('card_id, target_kind, target_id'),
    ]);

  const linkedOf = new Map<string, { target_kind: string; target_id: string }[]>();
  for (const link of links ?? []) {
    linkedOf.set(link.card_id, [...(linkedOf.get(link.card_id) ?? []), link]);
  }

  const path = `/startups/${startupId}/canvases/${canvasId}`;

  return (
    <>
      <AiSurface surface="canvas" entityType="canvas" entityId={canvasId} label={canvas.title_ar} />

      <section className="section-block">
        <div className="row-between">
          <div>
            <p className="kicker">{t(CANVAS_KIND[canvas.kind as CanvasKind].label)}</p>
            <h2 style={{ fontSize: '1.15rem', marginTop: 4 }}>{canvas.title_ar}</h2>
          </div>
          <AskAI prompt={`انظر إلى لوحة «${canvas.title_ar}» واقترح بطاقات للخانات الفارغة.`} />
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}/canvases`}>
            {t('كل اللوحات', 'All canvases')}
          </Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {canvas.summary_ar ?? t(CANVAS_KIND[canvas.kind as CanvasKind].hint)}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      <CanvasBoard
        startupId={startupId}
        canvasId={canvasId}
        blocks={(blocks ?? []) as Block[]}
        initialCards={(cards ?? []) as CanvasCard[]}
        canEdit={canEdit === true}
        isBusinessModel={canvas.kind === 'business_model'}
      />

      {canEdit === true && (cards ?? []).length > 0 && (
        <CardDoors
          cards={(cards ?? []).map((card) => ({
            id: card.id,
            body_ar: card.body_ar,
            linked: linkedOf.get(card.id) ?? [],
          }))}
          revalidate={path}
        />
      )}

      <section className="section-block">
        <div className="row-between">
          <h3 className="academy-heading">{t('النسخ', 'Versions')}</h3>
          {canEdit === true && (
            <form action={snapshotCanvas} className="row-actions">
              <input type="hidden" name="canvas_id" value={canvasId} />
              <input type="hidden" name="revalidate" value={path} />
              <input name="note" className="invite-message"
                     placeholder={t('لماذا هذه النسخة؟', 'Why this version?')}
                     aria-label={t('ملاحظة النسخة', 'Version note')} />
              <button className="btn btn-ghost btn-sm">{t('احفظ نسخة', 'Save a version')}</button>
            </form>
          )}
        </div>

        {(versions ?? []).length === 0 ? (
          <p className="notice">
            {t('لا نسخ محفوظة بعد. احفظ نسخة قبل تغيير كبير — الرجوع بعدها سهل.',
               'No versions yet. Save one before a big change — going back is easy afterwards.')}
          </p>
        ) : (
          <ul className="plain-list">
            {(versions ?? []).map((version) => (
              <li className="row-between" key={version.id} style={{ fontSize: '0.86rem' }}>
                <span>
                  <strong className="eng">v{version.version}</strong>
                  {version.note_ar && <span className="muted"> · {version.note_ar}</span>}
                  <span className="muted"> · {formatDateTime(locale, version.created_at)}</span>
                </span>
                {canEdit === true && (
                  <form action={restoreVersion}>
                    <input type="hidden" name="version_id" value={version.id} />
                    <input type="hidden" name="revalidate" value={path} />
                    <button className="btn btn-ghost btn-sm">{t('ارجع إليها', 'Restore')}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit === true && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.96rem' }}>{t('من يرى هذه اللوحة؟', 'Who sees this canvas?')}</h3>
          <form action={setCanvasVisibility} className="row-actions" style={{ marginTop: 10 }}>
            <input type="hidden" name="canvas_id" value={canvasId} />
            <input type="hidden" name="revalidate" value={path} />
            <select name="visibility" defaultValue={canvas.visibility}>
              <option value="workspace">{t('مساحة العمل فقط', 'The workspace only')}</option>
              <option value="mentors">{t("مساحة العمل والمنتورون", 'The workspace and its mentors')}</option>
              <option value="public">{t('العامة عبر صفحة الشركة', 'The public, on the company page')}</option>
            </select>
            <button className="btn btn-ghost btn-sm">{t('احفظ', 'Save')}</button>
          </form>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
            {t('الصفحة العامة لا تعرض شيئاً ما لم تكن الشركة نفسها معروضة.',
               'The public page shows nothing unless the company itself is public.')}
          </p>
        </section>
      )}
    </>
  );
}
