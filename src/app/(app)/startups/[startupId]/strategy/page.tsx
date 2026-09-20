import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { GOAL_STATUS, SWOT_QUADRANTS } from '@/lib/incubator';
import type { SmartGoal } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { addSwotItem, removeSwotItem, saveStrategy, updateGoalProgress } from '../../actions';
import { NewGoalForm } from './NewGoalForm';

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
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
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar} — الاستراتيجية</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>نظرة عامة</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          إلى أين تتجه، وكيف يعرف أي أحد أنك وصلت. الأهداف هنا تُقاس بأرقام وتواريخ، لا بالنوايا.
        </p>
      </section>

      <StartupNav startupId={startupId} />

      <form action={saveStrategy} className="panel section-block">
        <input type="hidden" name="startup_id" value={startupId} />
        <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>الرؤية والرسالة والقيم</h3>

        <div className="field">
          <label htmlFor="vision">الرؤية — أين تريد أن تكون؟</label>
          <textarea id="vision" name="vision" rows={2} defaultValue={strategy?.vision_ar ?? ''} disabled={!editable} />
        </div>

        <div className="field">
          <label htmlFor="mission">الرسالة — ما الذي تفعله كل يوم للوصول؟</label>
          <textarea id="mission" name="mission" rows={2} defaultValue={strategy?.mission_ar ?? ''} disabled={!editable} />
        </div>

        <div className="field">
          <label htmlFor="values">القيم (مفصولة بفاصلة)</label>
          <input id="values" name="values" defaultValue={(strategy?.values_ar ?? []).join('، ')} disabled={!editable} />
        </div>

        {editable && <button className="btn btn-primary btn-sm">احفظ</button>}
      </form>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>تحليل SWOT</h3>
        <div className="swot-grid">
          {SWOT_QUADRANTS.map((quadrant) => (
            <div className={`swot-quad ${quadrant.className}`} key={quadrant.key}>
              <h3>{quadrant.label}</h3>
              <p className="muted" style={{ fontSize: '0.76rem', marginBottom: 10 }}>{quadrant.hint}</p>

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
                  <input name="body" placeholder="أضف بنداً…" style={{ flex: 1, minWidth: 0, fontSize: '0.8rem' }} />
                  <button className="btn btn-ghost btn-sm">+</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>أهداف SMART</h3>
        <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 14 }}>
          محدد · قابل للقياس · قابل للتحقيق · ذو صلة · محدد بزمن. التقدّم يُحسب من الأرقام،
          ويُقارن بالوقت المنقضي حتى يظهر التأخر مبكراً.
        </p>

        {editable && <NewGoalForm startupId={startupId} />}

        {(goals?.length ?? 0) === 0 ? (
          <p className="notice">لا أهداف بعد.</p>
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
                    {GOAL_STATUS[goal.status].text}
                  </span>
                </div>

                <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>{goal.specific_ar}</p>

                <div className="goal-bars">
                  <div className="goal-bar-row">
                    <span className="lbl">الإنجاز</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
                    <span className="eng">{percent}%</span>
                  </div>
                  <div className="goal-bar-row">
                    <span className="lbl">الوقت</span>
                    <div className="progress-track"><div className="progress-fill time" style={{ width: `${elapsed}%` }} /></div>
                    <span className="eng">{elapsed}%</span>
                  </div>
                </div>

                {behind && (
                  <p className="notice notice-danger" style={{ marginTop: 10, fontSize: '0.82rem' }}>
                    الوقت يمضي أسرع من الإنجاز — راجع الهدف أو الخطة.
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
                    <strong>لماذا يهم:</strong> {goal.relevant_ar}
                  </p>
                )}
                {goal.achievable_ar && (
                  <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    <strong>لماذا ممكن:</strong> {goal.achievable_ar}
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
                      aria-label="القيمة الحالية"
                    />
                    <select name="status" defaultValue={goal.status}>
                      {Object.entries(GOAL_STATUS).map(([key, info]) => (
                        <option key={key} value={key}>{info.text}</option>
                      ))}
                    </select>
                    <button className="btn btn-ghost btn-sm">حدّث</button>
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
