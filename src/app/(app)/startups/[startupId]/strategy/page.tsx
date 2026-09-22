import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { GOAL_STATUS, SWOT_QUADRANTS } from '@/lib/incubator';
import type { SmartGoal } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { addSwotItem, removeSwotItem, saveStrategy, updateGoalProgress } from '../../actions';
import { NewGoalForm } from './NewGoalForm';
import { SwotDoor, type SwotOption } from './SwotDoor';

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase.from('startups').select('id, name_ar').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: strategy }, { data: swot }, { data: goals }, { data: goalProgress }, { data: canEdit }] =
    await Promise.all([
      supabase.from('startup_strategy').select('*').eq('startup_id', startupId).maybeSingle(),
      supabase.from('swot_items').select('*').eq('startup_id', startupId).order('sort_order'),
      supabase.from('smart_goals').select('*').eq('startup_id', startupId).order('due_on'),
      supabase.from('smart_goal_progress').select('*').eq('startup_id', startupId),
      supabase.rpc('can_edit_startup', { p_startup: startupId }),
    ]);

  const progressById = new Map((goalProgress ?? []).map((row) => [row.goal_id, row]));
  const editable = canEdit === true;

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — الاستراتيجية', ' — strategy')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('إلى أين تتجه، وكيف يعرف أي أحد أنك وصلت. الأهداف هنا تُقاس بأرقام وتواريخ، لا بالنوايا.', 'Where you are heading, and how anyone would know you got there. Goals here are measured in numbers and dates, not intentions.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      <form action={saveStrategy} className="panel section-block">
        <input type="hidden" name="startup_id" value={startupId} />
        <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('الرؤية والرسالة والقيم', 'Vision, mission and values')}</h3>

        <div className="field">
          <label htmlFor="vision">{t('الرؤية — أين تريد أن تكون؟', 'Vision — where do you want to be?')}</label>
          <textarea id="vision" name="vision" rows={2} defaultValue={strategy?.vision_ar ?? ''} disabled={!editable} />
        </div>

        <div className="field">
          <label htmlFor="mission">{t('الرسالة — ما الذي تفعله كل يوم للوصول؟', 'Mission — what do you do each day to get there?')}</label>
          <textarea id="mission" name="mission" rows={2} defaultValue={strategy?.mission_ar ?? ''} disabled={!editable} />
        </div>

        <div className="field">
          <label htmlFor="values">{t('القيم (مفصولة بفاصلة)', 'Values (comma separated)')}</label>
          <input id="values" name="values" defaultValue={(strategy?.values_ar ?? []).join(t('، ', ', '))} disabled={!editable} />
        </div>

        {editable && <button className="btn btn-primary btn-sm">{t('احفظ', 'Save')}</button>}
      </form>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('تحليل SWOT', 'SWOT analysis')}</h3>
        <div className="swot-grid">
          {SWOT_QUADRANTS.map((quadrant) => (
            <div className={`swot-quad ${quadrant.className}`} key={quadrant.key}>
              <h3>{t(quadrant.label)}</h3>
              <p className="muted" style={{ fontSize: '0.76rem', marginBottom: 10 }}>{t(quadrant.hint)}</p>

              {(swot ?? [])
                .filter((item) => item.quadrant === quadrant.key)
                .map((item) => (
                  <div className="row-between" key={item.id} style={{ marginBottom: 7 }}>
                    <span style={{ fontSize: '0.84rem' }}>{item.body_ar}</span>
                    {editable && (
                      <form action={removeSwotItem}>
                        <input type="hidden" name="item_id" value={item.id} />
                        <input type="hidden" name="startup_id" value={startupId} />
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                          ✕
                        </button>
                      </form>
                    )}
                  </div>
                ))}

              {editable && (
                <form action={addSwotItem} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <input type="hidden" name="startup_id" value={startupId} />
                  <input type="hidden" name="quadrant" value={quadrant.key} />
                  <input name="body" placeholder={t('أضف بنداً…', 'Add an item…')} style={{ flex: 1, minWidth: 0, fontSize: '0.8rem' }} />
                  <button className="btn btn-ghost btn-sm">+</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {editable && (
        <SwotDoor
          items={((swot ?? []) as SwotOption[]).filter((item) => item.quadrant === 'weakness' || item.quadrant === 'opportunity')}
          revalidate={`/startups/${startupId}/strategy`}
        />
      )}


      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>{t('أهداف SMART', 'SMART goals')}</h3>
        <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 14 }}>
          {t('محدد · قابل للقياس · قابل للتحقيق · ذو صلة · محدد بزمن. التقدّم يُحسب من الأرقام، ويُقارن بالوقت المنقضي حتى يظهر التأخر مبكراً.',
             'Specific · Measurable · Achievable · Relevant · Time-bound. Progress is computed from the numbers and compared against elapsed time, so slipping shows up early.')}
        </p>

        {editable && <NewGoalForm startupId={startupId} />}

        {(goals?.length ?? 0) === 0 ? (
          <p className="notice">{t('لا أهداف بعد.', 'No goals yet.')}</p>
        ) : (
          (goals as SmartGoal[]).map((goal) => {
            const progress = progressById.get(goal.id);
            const percent = progress?.percent ?? 0;
            const elapsed = progress?.time_elapsed_percent ?? 0;
            const behind = elapsed - percent >= 20;

            return (
              <article className="panel section-block" key={goal.id}>
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: '0.95rem' }}>{goal.title_ar}</h4>
                  <span className={`status-pill ${GOAL_STATUS[goal.status].className}`}>
                    {t(GOAL_STATUS[goal.status].text)}
                  </span>
                </div>

                <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>{goal.specific_ar}</p>

                <div className="goal-bars">
                  <div className="goal-bar-row">
                    <span className="lbl">{t('الإنجاز', 'Progress')}</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
                    <span className="eng">{percent}%</span>
                  </div>
                  <div className="goal-bar-row">
                    <span className="lbl">{t('الوقت', 'Time')}</span>
                    <div className="progress-track"><div className="progress-fill time" style={{ width: `${elapsed}%` }} /></div>
                    <span className="eng">{elapsed}%</span>
                  </div>
                </div>

                {behind && (
                  <p className="notice notice-danger" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    {t('الوقت يمضي أسرع من الإنجاز — راجع الهدف أو الخطة.', 'Time is moving faster than progress — revisit the goal or the plan.')}
                  </p>
                )}

                <div className="tags-row" style={{ marginTop: 12 }}>
                  <span className="badge-pill eng">
                    {goal.current_value} / {goal.target_value} {goal.metric_label_ar}
                  </span>
                  <span className="badge-pill eng">{goal.starts_on} → {goal.due_on}</span>
                </div>

                {goal.relevant_ar && (
                  <p className="muted" style={{ fontSize: '0.82rem', marginTop: 10 }}>
                    <strong>{t('لماذا يهم:', 'Why it matters:')}</strong> {goal.relevant_ar}
                  </p>
                )}
                {goal.achievable_ar && (
                  <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    <strong>{t('لماذا ممكن:', 'Why it is achievable:')}</strong> {goal.achievable_ar}
                  </p>
                )}

                {editable && (
                  <form action={updateGoalProgress} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <input type="hidden" name="goal_id" value={goal.id} />
                    <input type="hidden" name="startup_id" value={startupId} />
                    <input
                      name="current_value"
                      type="number"
                      step="0.01"
                      defaultValue={goal.current_value}
                      dir="ltr"
                      style={{ width: 120 }}
                      aria-label={t('القيمة الحالية', 'Current value')}
                    />
                    <select name="status" defaultValue={goal.status}>
                      {Object.entries(GOAL_STATUS).map(([key, info]) => (
                        <option key={key} value={key}>{t(info.text)}</option>
                      ))}
                    </select>
                    <button className="btn btn-ghost btn-sm">{t('حدّث', 'Update')}</button>
                  </form>
                )}
              </article>
            );
          })
        )}
      </section>
    </>
  );
}
