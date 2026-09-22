import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { STARTUP_STAGES } from '@/lib/incubator';

import { StartupNav } from '../StartupNav';
import { AdvanceForm } from './AdvanceForm';
import { tickRequirement } from './actions';

/**
 * The ladder, and what this rung is actually asking for.
 *
 * Every line here is answered by work that exists somewhere else in the
 * platform — a finished plan section, cards on a canvas, a goal achieved, a
 * mentor session held. A rung nobody can fail to reach would be a label, so
 * this one refuses to be climbed until its required lines are true.
 */
export default async function IncubationPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase
    .from('startups').select('id, name_ar, stage, is_in_incubator').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: stages }, { data: progress }, { data: canManage }, { data: history }] = await Promise.all([
    supabase.from('incubation_stages').select('stage, sort_order, title_ar, purpose_ar').order('sort_order'),
    supabase.rpc('stage_progress', { p_startup: startupId }),
    supabase.rpc('can_manage_startup', { p_startup: startupId }),
    supabase.from('startup_stage_history').select('stage, note_ar, changed_at')
      .eq('startup_id', startupId).order('changed_at', { ascending: false }),
  ]);

  const ladder = stages ?? [];
  const current = ladder.find((row) => row.stage === startup.stage);
  const items = progress ?? [];
  const required = items.filter((row) => row.is_required);
  const met = required.filter((row) => row.met).length;
  const ready = required.length > 0 && met === required.length;

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — رحلة الاحتضان', ' — the incubation journey')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('كل مرحلة تطلب شيئاً يمكن للمنصة أن تراه: قسماً مكتملاً في الخطة، بطاقات على اللوحة، هدفاً تحقّق، جلسة إرشاد عُقدت. لا تُرفع المرحلة بالضغط على زر، بل بإنجاز ما تطلبه.',
             'Each stage asks for something the platform can see: a finished plan section, cards on a canvas, a goal achieved, a mentoring session held. A stage is not raised by pressing a button, but by doing what it asks.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      <section className="section-block">
        <ol className="ladder">
          {ladder.map((rung) => {
            const isCurrent = rung.stage === startup.stage;
            const isPast = (current?.sort_order ?? 0) > rung.sort_order;
            return (
              <li key={rung.stage} className={`ladder-rung${isCurrent ? ' is-current' : ''}${isPast ? ' is-past' : ''}`}>
                <span className="ladder-num eng">{rung.sort_order}</span>
                <div>
                  <strong>{rung.title_ar}</strong>
                  <p className="muted" style={{ fontSize: '0.8rem' }}>{rung.purpose_ar}</p>
                </div>
                {isCurrent && (
                  <span className="status-pill status-ok">
                    {met}/{required.length} {t('مكتمل', 'done')}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>
          {t('ما تطلبه هذه المرحلة', 'What this stage asks for')}
          {current && <span className="muted" style={{ fontWeight: 400 }}> · {current.title_ar}</span>}
        </h3>

        <ul className="plain-list" style={{ marginTop: 12 }}>
          {items.map((item) => (
            <li className="row-between" key={item.requirement_key} style={{ fontSize: '0.88rem' }}>
              <span>
                <span className={item.met ? 'req-met' : 'req-open'}>{item.met ? '✓' : '○'}</span>
                {' '}{item.title_ar}
                {!item.is_required && (
                  <span className="muted"> · {t('اختياري', 'optional')}</span>
                )}
                {item.detail_ar && (
                  <p className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>{item.detail_ar}</p>
                )}
              </span>

              {canManage === true && item.requirement_key.startsWith('growth.') && (
                <form action={tickRequirement}>
                  <input type="hidden" name="startup_id" value={startupId} />
                  <input type="hidden" name="requirement_key" value={item.requirement_key} />
                  <input type="hidden" name="state" value={item.met ? 'off' : 'on'} />
                  <button className="btn btn-ghost btn-sm">
                    {item.met ? t('تراجع', 'Untick') : t('تمّ', 'Mark done')}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {canManage === true && <AdvanceForm startupId={startupId} ready={ready} />}

        {canManage !== true && (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
            {t('رفع المرحلة لمن يدير الشركة.', 'Raising the stage belongs to whoever runs the company.')}
          </p>
        )}
      </section>

      {(history ?? []).length > 0 && (
        <section className="section-block">
          <h3 className="academy-heading">{t('سجل الرحلة', 'The climb')}</h3>
          <ul className="plain-list">
            {(history ?? []).map((row, index) => (
              <li className="row-between" key={`${row.stage}-${index}`} style={{ fontSize: '0.86rem' }}>
                <span>
                  {STARTUP_STAGES.find((stage) => stage.key === row.stage)?.label.ar ?? row.stage}
                  {row.note_ar && <span className="muted"> · {row.note_ar}</span>}
                </span>
                <span className="muted">{formatDate(locale, row.changed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
