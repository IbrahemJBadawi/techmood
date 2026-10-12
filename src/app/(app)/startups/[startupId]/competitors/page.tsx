import { ActionForm } from '@/components/ActionForm';
import type { Database } from '@/lib/database.types';
import type { T } from '@/lib/i18n';

import { deleteCompetitor, saveCompetitor } from '../../studio-actions';
import { ToolHeader, loadStudio } from '../ToolHeader';

type Competitor = Database['public']['Tables']['startup_competitors']['Row'];

const KINDS = {
  direct: { ar: 'مباشر', en: 'Direct' },
  indirect: { ar: 'غير مباشر', en: 'Indirect' },
  substitute: { ar: 'بديل', en: 'Substitute' },
} as const;

/**
 * The competitors (0166): who else solves the problem — directly, from the
 * side, or the way people manage today without anyone (the substitute) — and
 * where this startup is better. A price/quality map puts them and us on one
 * picture, which is usually where the gap shows.
 */
export default async function CompetitorsPage({ params }: { params: Promise<{ startupId: string }> }) {
  const { startupId } = await params;
  const { t, supabase, startup, editable } = await loadStudio(startupId);
  const [{ data: rows }, { data: market }] = await Promise.all([
    supabase.from('startup_competitors').select('*').eq('startup_id', startupId).order('sort_order').order('created_at'),
    supabase.from('startup_market').select('our_price, our_quality').eq('startup_id', startupId).maybeSingle(),
  ]);
  const competitors = (rows ?? []) as Competitor[];
  const placed = competitors.filter((c) => c.price_level && c.quality_level);
  const us = market?.our_price && market?.our_quality ? { price: market.our_price, quality: market.our_quality } : null;
  const at = (value: number) => `${((value - 1) / 4) * 70 + 15}%`;

  return (
    <>
      <ToolHeader
        startupId={startupId}
        name={startup.name_ar}
        tool="competitors"
        ask={`حلّل منافسي «${startup.name_ar}»: من أغفلت؟ وأين الفجوة التي يمكن أن نملكها؟`}
        intro={t('من يحلّ المشكلة غيرك؟ المنافس المباشر، وغير المباشر، والبديل الذي يستعمله الناس اليوم (حتى لو كان ورقة وقلماً).',
                 'Who else solves it? The direct competitor, the indirect one, and the substitute people use today — even if it is pen and paper.')}
      />

      <div className="detail-grid studio-split">
        <section className="panel">
          <h3 className="studio-h3">{t('خريطة الموقع: السعر × الجودة', 'Position map: price × quality')}</h3>
          {placed.length === 0 && !us ? (
            <p className="notice">{t('أعطِ كل منافس سعراً وجودة من 1 إلى 5 ليظهر هنا — وحدّد موقعك في صفحة السوق.',
                                     'Give each competitor a price and a quality from 1 to 5 to place it — and set yours on the market page.')}</p>
          ) : (
            <div className="position-map" dir="ltr" role="img" aria-label={t('خريطة السعر والجودة', 'Price and quality map')}>
              <span className="axis axis-x">{t('السعر →', 'Price →')}</span>
              <span className="axis axis-y">{t('الجودة ↑', 'Quality ↑')}</span>
              {placed.map((c) => (
                <span key={c.id} className={`dot dot-${c.kind}`} style={{ left: at(c.price_level!), bottom: at(c.quality_level!) }}>
                  <bdi>{c.name}</bdi>
                </span>
              ))}
              {us && (
                <span className="dot dot-us" style={{ left: at(us.price), bottom: at(us.quality) }}>
                  <bdi>{t('نحن', 'Us')}</bdi>
                </span>
              )}
            </div>
          )}
          <p className="muted studio-note">
            {t('الزاوية العليا اليسرى (جودة عالية بسعر منخفض) هي حيث يريد الجميع أن يكون — هل لديك ما يبرّر وجودك هناك؟',
               'The top-left corner (high quality, low price) is where everyone wants to be — can you justify being there?')}
          </p>
        </section>

        {editable ? (
          <ActionForm action={saveCompetitor} submitLabel={t('أضف المنافس', 'Add the competitor')} className="panel studio-form">
            <h3 className="studio-h3">{t('منافس جديد', 'A new competitor')}</h3>
            <CompetitorFields t={t} startupId={startupId} />
          </ActionForm>
        ) : null}
      </div>

      <section className="section-block">
        <h3 className="studio-h3">{t(`المنافسون (${competitors.length})`, `Competitors (${competitors.length})`)}</h3>
        {competitors.length === 0 ? (
          <p className="notice">{t('لا منافسين بعد. «لا يوجد لدينا منافس» نادراً ما تكون صحيحة — ابدأ بالبديل الذي يستعمله الناس اليوم.',
                                   'None yet. «We have no competitors» is rarely true — start with what people use today.')}</p>
        ) : (
          <div className="studio-cards">
            {competitors.map((c) => (
              <article className="card studio-card" key={c.id}>
                <div className="row-between">
                  <h4><bdi>{c.name}</bdi></h4>
                  <span className={`tag tag-${c.kind}`}>{t(KINDS[c.kind])}</span>
                </div>
                {c.website_url && <a className="studio-link eng" href={c.website_url} target="_blank" rel="noreferrer noopener">{c.website_url.replace(/^https?:\/\//, '')}</a>}
                {c.pricing_ar && <p className="studio-line"><strong>{t('التسعير: ', 'Pricing: ')}</strong>{c.pricing_ar}</p>}
                {c.strengths_ar && <p className="studio-line"><strong>{t('قوته: ', 'Strengths: ')}</strong>{c.strengths_ar}</p>}
                {c.weaknesses_ar && <p className="studio-line"><strong>{t('ضعفه: ', 'Weaknesses: ')}</strong>{c.weaknesses_ar}</p>}
                {c.our_edge_ar && <p className="studio-line studio-edge"><strong>{t('أين نتفوّق: ', 'Our edge: ')}</strong>{c.our_edge_ar}</p>}
                {editable && (
                  <div className="studio-card-actions">
                    <details className="studio-edit">
                      <summary className="btn btn-ghost btn-sm">{t('تعديل', 'Edit')}</summary>
                      <ActionForm action={saveCompetitor} submitLabel={t('احفظ', 'Save')} className="studio-form">
                        <CompetitorFields t={t} startupId={startupId} row={c} />
                      </ActionForm>
                    </details>
                    <ActionForm action={deleteCompetitor} submitLabel={t('حذف', 'Remove')} variant="ghost"
                                confirm={t(`حذف «${c.name}» من المنافسين؟`, `Remove «${c.name}» from the competitors?`)}>
                      <input type="hidden" name="startup_id" value={startupId} />
                      <input type="hidden" name="id" value={c.id} />
                    </ActionForm>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CompetitorFields({ t, startupId, row }: { t: T; startupId: string; row?: Competitor }) {
  const key = row?.id ?? 'new';
  return (
    <>
      <input type="hidden" name="startup_id" value={startupId} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="studio-num-grid studio-num-grid-2">
        <div className="field">
          <label htmlFor={`name-${key}`}>{t('الاسم', 'Name')}</label>
          <input id={`name-${key}`} name="name" required maxLength={80} defaultValue={row?.name ?? ''} />
        </div>
        <div className="field">
          <label htmlFor={`kind-${key}`}>{t('النوع', 'Kind')}</label>
          <select id={`kind-${key}`} name="kind" defaultValue={row?.kind ?? 'direct'}>
            {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((kind) => <option key={kind} value={kind}>{t(KINDS[kind])}</option>)}
          </select>
        </div>
      </div>
      <div className="studio-num-grid studio-num-grid-2">
        <div className="field">
          <label htmlFor={`website-${key}`}>{t('الموقع', 'Website')}</label>
          <input id={`website-${key}`} name="website" dir="ltr" defaultValue={row?.website_url ?? ''} placeholder="https://" />
        </div>
        <div className="field">
          <label htmlFor={`pricing-${key}`}>{t('التسعير', 'Pricing')}</label>
          <input id={`pricing-${key}`} name="pricing" maxLength={200} defaultValue={row?.pricing_ar ?? ''} placeholder={t('مثال: 30$ شهرياً', 'e.g. $30 a month')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`strengths-${key}`}>{t('نقاط قوته', 'Strengths')}</label>
        <textarea id={`strengths-${key}`} name="strengths" rows={2} defaultValue={row?.strengths_ar ?? ''} />
      </div>
      <div className="field">
        <label htmlFor={`weaknesses-${key}`}>{t('نقاط ضعفه', 'Weaknesses')}</label>
        <textarea id={`weaknesses-${key}`} name="weaknesses" rows={2} defaultValue={row?.weaknesses_ar ?? ''} />
      </div>
      <div className="field">
        <label htmlFor={`edge-${key}`}>{t('أين نتفوّق عليه؟', 'Where do we beat it?')}</label>
        <textarea id={`edge-${key}`} name="edge" rows={2} defaultValue={row?.our_edge_ar ?? ''} />
      </div>
      <div className="studio-num-grid studio-num-grid-2">
        <div className="field">
          <label htmlFor={`price-${key}`}>{t('السعر (1 رخيص – 5 غالٍ)', 'Price (1 cheap – 5 dear)')}</label>
          <select id={`price-${key}`} name="price_level" defaultValue={row?.price_level ?? ''}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`quality-${key}`}>{t('الجودة (1–5)', 'Quality (1–5)')}</label>
          <select id={`quality-${key}`} name="quality_level" defaultValue={row?.quality_level ?? ''}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}
