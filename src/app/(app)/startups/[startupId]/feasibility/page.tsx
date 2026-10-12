import { ActionForm } from '@/components/ActionForm';
import { shortUsd } from '@/lib/studio-tools';

import { saveFeasibility } from '../../studio-actions';
import { ToolHeader, loadStudio } from '../ToolHeader';

const money = (value: number) => `${value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}$`;

/**
 * Feasibility (0166): five numbers in — the price of one unit, what one unit
 * costs, the monthly fixed costs, what it takes to start, and the first
 * month's sales with their growth. Out: the margin on each unit, the units a
 * month that pay the fixed costs, the first month in profit and the month the
 * starting money is back. The database computes it, so the plan, the
 * assistant and this page read the same answer.
 */
export default async function FeasibilityPage({ params }: { params: Promise<{ startupId: string }> }) {
  const { startupId } = await params;
  const { t, supabase, startup, editable } = await loadStudio(startupId);
  const [{ data: inputs }, { data: summaryRows }, { data: months }] = await Promise.all([
    supabase.from('startup_feasibility').select('*').eq('startup_id', startupId).maybeSingle(),
    supabase.rpc('feasibility_summary', { p_startup: startupId }),
    supabase.rpc('feasibility_projection', { p_startup: startupId }),
  ]);
  const summary = summaryRows?.[0];
  const rows = (months ?? []).map((row) => ({
    ...row, revenue: Number(row.revenue), profit: Number(row.profit), cumulative: Number(row.cumulative),
  }));
  const peak = Math.max(1, ...rows.map((row) => Math.abs(row.cumulative)));
  const unit = inputs?.unit_ar || t('وحدة', 'unit');
  const hasNumbers = !!inputs && Number(inputs.price_usd) > 0;

  const fields = (
    <fieldset disabled={!editable}>
      <div className="studio-num-grid studio-num-grid-2">
        <div className="field">
          <label htmlFor="unit">{t('ماذا تبيع؟ (الوحدة)', 'What do you sell? (the unit)')}</label>
          <input id="unit" name="unit" maxLength={40} defaultValue={inputs?.unit_ar ?? ''} placeholder={t('اشتراك شهري، طلب، جلسة…', 'monthly subscription, order, session…')} />
        </div>
        <div className="field">
          <label htmlFor="price">{t('سعر الوحدة ($)', 'Price per unit ($)')}</label>
          <input id="price" name="price" inputMode="decimal" dir="ltr" defaultValue={inputs?.price_usd ?? ''} placeholder="20" />
        </div>
        <div className="field">
          <label htmlFor="variable_cost">{t('تكلفة الوحدة الواحدة ($)', 'Cost of one unit ($)')}</label>
          <input id="variable_cost" name="variable_cost" inputMode="decimal" dir="ltr" defaultValue={inputs?.variable_cost_usd ?? ''} placeholder="5" />
        </div>
        <div className="field">
          <label htmlFor="fixed_monthly">{t('التكاليف الثابتة شهرياً ($)', 'Fixed costs a month ($)')}</label>
          <input id="fixed_monthly" name="fixed_monthly" inputMode="decimal" dir="ltr" defaultValue={inputs?.fixed_monthly_usd ?? ''} placeholder="3000" />
        </div>
        <div className="field">
          <label htmlFor="startup_cost">{t('تكاليف البدء لمرة واحدة ($)', 'One-off starting costs ($)')}</label>
          <input id="startup_cost" name="startup_cost" inputMode="decimal" dir="ltr" defaultValue={inputs?.startup_cost_usd ?? ''} placeholder="6000" />
        </div>
        <div className="field">
          <label htmlFor="units_month1">{t('المبيعات في الشهر الأول (وحدات)', 'Sales in month one (units)')}</label>
          <input id="units_month1" name="units_month1" inputMode="numeric" dir="ltr" defaultValue={inputs?.units_month1 ?? ''} placeholder="100" />
        </div>
        <div className="field">
          <label htmlFor="growth">{t('النمو الشهري (%)', 'Monthly growth (%)')}</label>
          <input id="growth" name="growth" inputMode="decimal" dir="ltr" defaultValue={inputs?.growth_pct ?? ''} placeholder="10" />
        </div>
        <div className="field">
          <label htmlFor="months">{t('المدة (أشهر)', 'Horizon (months)')}</label>
          <select id="months" name="months" defaultValue={inputs?.months ?? 12}>
            {[6, 12, 18, 24, 36].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="notes">{t('افتراضاتك', 'Your assumptions')}</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={inputs?.notes_ar ?? ''}
                  placeholder={t('لماذا 100 وحدة في الشهر الأول؟ ولماذا هذا النمو؟', 'Why 100 units in month one? Why this growth?')} />
      </div>
    </fieldset>
  );

  return (
    <>
      <ToolHeader
        startupId={startupId}
        name={startup.name_ar}
        tool="feasibility"
        ask={`راجع أرقام جدوى «${startup.name_ar}»: هل الافتراضات معقولة؟ وما الرقم الذي لو تغيّر قليلاً يغيّر النتيجة أكثر؟`}
        intro={t('خمسة أرقام تدخل، والجواب يخرج: كم يبقى لك من كل وحدة، وكم وحدة شهرياً تغطي التكاليف، ومتى يعود رأس المال.',
                 'Five numbers in, the answer out: what each unit leaves you, how many a month cover the costs, and when the starting money comes back.')}
      />

      {hasNumbers && summary ? (
        <section className="section-block">
          <div className="stat-tiles">
            <div className="stat-tile">
              <div className="val eng">{money(Number(summary.margin_usd))}</div>
              <div className="lbl">{t(`ربح كل ${unit}`, `Margin per ${unit}`)}{summary.margin_pct != null && <span className="eng"> ({summary.margin_pct}%)</span>}</div>
            </div>
            <div className="stat-tile">
              <div className="val eng">{summary.breakeven_units ?? '—'}</div>
              <div className="lbl">{t('وحدة شهرياً لنقطة التعادل', 'units a month to break even')}</div>
            </div>
            <div className="stat-tile">
              <div className="val eng">{summary.first_profit_month ?? '—'}</div>
              <div className="lbl">{t('أول شهر رابح', 'first month in profit')}</div>
            </div>
            <div className="stat-tile">
              <div className="val eng">{summary.payback_month ?? '—'}</div>
              <div className="lbl">{t('شهر استرداد رأس المال', 'payback month')}</div>
            </div>
            <div className="stat-tile">
              <div className="val eng">{shortUsd(Number(summary.total_revenue))}</div>
              <div className="lbl">{t(`الإيرادات خلال ${inputs!.months} شهراً`, `Revenue over ${inputs!.months} months`)}</div>
            </div>
          </div>
          <p className={`notice ${summary.payback_month ? 'notice-ok' : 'notice-warn'} studio-verdict`}>
            {Number(summary.margin_usd) <= 0
              ? t('كل وحدة تُباع بخسارة — لا حجم مبيعات ينقذ هذا. ارفع السعر أو اخفض تكلفة الوحدة أولاً.',
                  'Every unit sells at a loss — no volume saves that. Raise the price or cut the unit cost first.')
              : summary.payback_month
                ? t(`بهذه الافتراضات يعود رأس المال في الشهر ${summary.payback_month}.`, `With these assumptions the money is back in month ${summary.payback_month}.`)
                : t(`لا يعود رأس المال خلال ${inputs!.months} شهراً بهذه الافتراضات — جرّب مدة أطول أو راجع النمو والتكاليف.`,
                    `The money does not come back within ${inputs!.months} months — try a longer horizon or revisit growth and costs.`)}
          </p>
        </section>
      ) : null}

      <div className="detail-grid studio-split">
        {editable ? (
          <ActionForm action={saveFeasibility} submitLabel={t('احسب', 'Calculate')} className="panel studio-form">
            <input type="hidden" name="startup_id" value={startupId} />
            {fields}
          </ActionForm>
        ) : (
          <div className="panel studio-form">{fields}</div>
        )}

        <section className="panel">
          <h3 className="studio-h3">{t('الرصيد التراكمي شهراً بشهر', 'Running balance, month by month')}</h3>
          {rows.length === 0 || !hasNumbers ? (
            <p className="notice">{t('أدخل السعر والتكاليف والمبيعات، ثم «احسب».', 'Enter the price, the costs and the sales, then «Calculate».')}</p>
          ) : (
            <>
              <div className="cash-chart" dir="ltr" role="img"
                   aria-label={t('الرصيد التراكمي لكل شهر', 'The running balance for each month')}>
                {rows.map((row) => (
                  <div className="cash-col" key={row.month} title={`${row.month}: ${money(row.cumulative)}`}>
                    <div className="cash-half cash-up">
                      {row.cumulative > 0 && <span className="cash-bar" style={{ height: `${(100 * row.cumulative) / peak}%` }} />}
                    </div>
                    <div className="cash-half cash-down">
                      {row.cumulative < 0 && <span className="cash-bar" style={{ height: `${(100 * -row.cumulative) / peak}%` }} />}
                    </div>
                    <span className="cash-month">{row.month}</span>
                  </div>
                ))}
              </div>
              <div className="table-scroll">
                <table className="studio-table">
                  <thead>
                    <tr>
                      <th>{t('الشهر', 'Month')}</th>
                      <th>{t('الوحدات', 'Units')}</th>
                      <th>{t('الإيراد', 'Revenue')}</th>
                      <th>{t('الربح', 'Profit')}</th>
                      <th>{t('التراكمي', 'Running')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.month} className={row.month === summary?.payback_month ? 'is-payback' : undefined}>
                        <td className="eng">{row.month}</td>
                        <td className="eng">{row.units.toLocaleString('en-US')}</td>
                        <td className="eng">{money(row.revenue)}</td>
                        <td className={`eng ${row.profit < 0 ? 'is-neg' : 'is-pos'}`}>{money(row.profit)}</td>
                        <td className={`eng ${row.cumulative < 0 ? 'is-neg' : 'is-pos'}`}>{money(row.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
