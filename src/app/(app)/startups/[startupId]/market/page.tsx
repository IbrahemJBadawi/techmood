import { ActionForm } from '@/components/ActionForm';
import { shortUsd } from '@/lib/studio-tools';

import { saveMarket } from '../../studio-actions';
import { ToolHeader, loadStudio } from '../ToolHeader';

/**
 * The market (0166): three circles inside one another — everyone who has the
 * problem (TAM), the part this startup can serve (SAM), and the part it can
 * realistically win in the next years (SOM) — and how those numbers were
 * reached, because a number without its method convinces nobody.
 */
export default async function MarketPage({ params }: { params: Promise<{ startupId: string }> }) {
  const { startupId } = await params;
  const { t, supabase, startup, editable } = await loadStudio(startupId);
  const { data: market } = await supabase.from('startup_market').select('*').eq('startup_id', startupId).maybeSingle();

  const tam = market?.tam_usd ?? null;
  const sam = market?.sam_usd ?? null;
  const som = market?.som_usd ?? null;
  // the circles keep their proportions, with a floor so the smallest stays visible
  const size = (value: number | null) => (tam && value ? Math.max(18, Math.round(100 * Math.sqrt(value / tam))) : 0);

  const fields = (
    <fieldset disabled={!editable}>
      <div className="field">
        <label htmlFor="segment">{t('الشريحة المستهدفة', 'Target segment')}</label>
        <textarea id="segment" name="segment" rows={2} defaultValue={market?.segment_ar ?? ''}
                  placeholder={t('مثال: العيادات الصغيرة في المدن، بطبيب أو اثنين', 'e.g. small city clinics with one or two doctors')} />
      </div>
      <div className="studio-num-grid">
        <div className="field">
          <label htmlFor="tam">TAM <span className="muted">{t('(الكلي، $ سنوياً)', '(total, $/year)')}</span></label>
          <input id="tam" name="tam" inputMode="numeric" dir="ltr" defaultValue={tam ?? ''} placeholder="50000000" />
        </div>
        <div className="field">
          <label htmlFor="sam">SAM <span className="muted">{t('(المخدوم)', '(served)')}</span></label>
          <input id="sam" name="sam" inputMode="numeric" dir="ltr" defaultValue={sam ?? ''} placeholder="4000000" />
        </div>
        <div className="field">
          <label htmlFor="som">SOM <span className="muted">{t('(الممكن)', '(obtainable)')}</span></label>
          <input id="som" name="som" inputMode="numeric" dir="ltr" defaultValue={som ?? ''} placeholder="200000" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="method">{t('كيف حسبتها؟', 'How did you get there?')}</label>
        <textarea id="method" name="method" rows={3} defaultValue={market?.method_ar ?? ''}
                  placeholder={t('عدد العملاء المحتملين × ما يدفعه الواحد سنوياً…', 'Number of potential customers × what each pays a year…')} />
      </div>
      <div className="field">
        <label htmlFor="trends">{t('الاتجاهات التي تدفع السوق', 'Trends pushing the market')}</label>
        <textarea id="trends" name="trends" rows={2} defaultValue={market?.trends_ar ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="sources">{t('المصادر', 'Sources')}</label>
        <input id="sources" name="sources" defaultValue={market?.sources_ar ?? ''} placeholder={t('تقارير، إحصاءات رسمية، مقابلات', 'Reports, official statistics, interviews')} />
      </div>
      <div className="studio-num-grid studio-num-grid-2">
        <div className="field">
          <label htmlFor="our_price">{t('سعرنا مقارنة بالسوق (1–5)', 'Our price vs the market (1–5)')}</label>
          <select id="our_price" name="our_price" defaultValue={market?.our_price ?? ''}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="our_quality">{t('جودتنا (1–5)', 'Our quality (1–5)')}</label>
          <select id="our_quality" name="our_quality" defaultValue={market?.our_quality ?? ''}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <p className="muted studio-note">{t('السعر والجودة يضعانك على خريطة المنافسين.', 'Price and quality put you on the competitors’ map.')}</p>
    </fieldset>
  );

  return (
    <>
      <ToolHeader
        startupId={startupId}
        name={startup.name_ar}
        tool="market"
        ask={`ساعدني أقدّر حجم سوق «${startup.name_ar}»: TAM وSAM وSOM بطريقة من الأسفل للأعلى، مع افتراضات واضحة.`}
        intro={t('ثلاث دوائر متداخلة: كل من لديه المشكلة، ثم من تستطيع خدمتهم فعلاً، ثم من تستطيع كسبهم خلال سنتين أو ثلاث. اكتب كيف وصلت لكل رقم.',
                 'Three nested circles: everyone with the problem, those you can actually serve, and those you can win in two or three years. Say how you reached each number.')}
      />

      <div className="detail-grid studio-split">
        <section className="panel">
          <h3 className="studio-h3">{t('حجم السوق', 'Market size')}</h3>
          {tam ? (
            <div className="market-rings" role="img"
                 aria-label={t(`السوق الكلي ${shortUsd(tam)}، المخدوم ${shortUsd(sam)}، الممكن ${shortUsd(som)}`,
                               `Total ${shortUsd(tam)}, served ${shortUsd(sam)}, obtainable ${shortUsd(som)}`)}>
              <div className="ring ring-tam" />
              {sam ? <div className="ring ring-sam" style={{ width: `${size(sam)}%` }} /> : null}
              {som ? <div className="ring ring-som" style={{ width: `${size(som)}%` }} /> : null}
            </div>
          ) : null}
          {tam ? (
            <ul className="market-legend">
              <li><span className="swatch ring-tam" /><strong>TAM</strong> {t('السوق الكلي', 'Total market')}<bdi className="eng">{shortUsd(tam)}</bdi></li>
              <li><span className="swatch ring-sam" /><strong>SAM</strong> {t('ما تستطيع خدمته', 'What you can serve')}<bdi className="eng">{shortUsd(sam)}</bdi></li>
              <li><span className="swatch ring-som" /><strong>SOM</strong> {t('ما تستطيع كسبه', 'What you can win')}<bdi className="eng">{shortUsd(som)}</bdi></li>
            </ul>
          ) : (
            <p className="notice">{t('ابدأ بالسوق الكلي — الدوائر ترتسم وحدها.', 'Start with the total market — the circles draw themselves.')}</p>
          )}
          {tam && som ? (
            <p className="muted studio-note">
              {t(`تستهدف ${((100 * som) / tam).toFixed(som / tam < 0.01 ? 2 : 1)}% من السوق الكلي.`,
                 `You are aiming at ${((100 * som) / tam).toFixed(som / tam < 0.01 ? 2 : 1)}% of the total market.`)}
            </p>
          ) : null}
          {market?.trends_ar && (
            <>
              <h4 className="studio-h4">{t('الاتجاهات', 'Trends')}</h4>
              <p className="studio-body">{market.trends_ar}</p>
            </>
          )}
        </section>

        {editable ? (
          <ActionForm action={saveMarket} submitLabel={t('احفظ السوق', 'Save the market')} className="panel studio-form">
            <input type="hidden" name="startup_id" value={startupId} />
            {fields}
          </ActionForm>
        ) : (
          <div className="panel studio-form">{fields}</div>
        )}
      </div>
    </>
  );
}
