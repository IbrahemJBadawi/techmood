import { AskAI } from '@/components/AskAI';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { criterionLabel } from '@/lib/criteria';

/**
 * Rating, performance and feedback, kept as separate layers (0081).
 *
 * Performance is counted from what happened; the strengths and improvements
 * are read off the criteria people rated; the written comments are shown only
 * to the person they are about (and admins), with an optional AI summary that
 * describes the feedback and never judges the person.
 */
export async function FeedbackSummary({ profileId, isMentor }: { profileId: string; isMentor: boolean }) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSelf = user?.id === profileId;

  const [{ data: performance }, { data: digest }, { data: texts }] = await Promise.all([
    isMentor ? supabase.rpc('mentor_performance', { p_mentor: profileId }) : Promise.resolve({ data: null }),
    supabase.rpc('feedback_digest', { p_profile: profileId }),
    isSelf ? supabase.rpc('feedback_texts', { p_profile: profileId }) : Promise.resolve({ data: null }),
  ]);

  const perf = performance?.[0];
  const strengths = (digest ?? []).filter((row) => row.kind === 'strength');
  const improve = (digest ?? []).filter((row) => row.kind === 'improve');
  const comments = (texts ?? []).filter((row) => row.liked_ar || row.improve_ar || row.comment_ar).slice(0, 20);

  if (!perf?.sessions_held && (digest ?? []).length === 0) return null;

  const pct = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value}%`);
  const aiPrompt = [
    'لخّص هذه الملاحظات عن عملي في «نقاط القوة» و«فرص التحسين» بنقاط قصيرة، بدون أي حكم على شخصي، واذكر فقط ما تكرر:',
    ...comments.map((row) => `- (${row.stars}★) ${[row.liked_ar && `أفاد: ${row.liked_ar}`, row.improve_ar && `تحسين: ${row.improve_ar}`, row.comment_ar].filter(Boolean).join(' · ')}`),
  ].join('\n');

  return (
    <section className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('التقييم والأداء', 'Rating and performance')}</h3>

      {perf && perf.sessions_held > 0 && (
        <div className="stat-tiles" style={{ marginTop: 12 }}>
          <div className="stat-tile"><div className="val eng">{perf.stars_avg ?? '—'}★</div><div className="lbl">{t(`${perf.rated_count} تقييماً موثقاً`, `${perf.rated_count} verified ratings`)}</div></div>
          <div className="stat-tile"><div className="val eng">{perf.sessions_held}</div><div className="lbl">{t('جلسة منعقدة', 'Sessions held')}</div></div>
          <div className="stat-tile"><div className="val eng">{pct(perf.attendance_pct)}</div><div className="lbl">{t('حضور', 'Attendance')}</div></div>
          <div className="stat-tile"><div className="val eng">{pct(perf.satisfaction_pct)}</div><div className="lbl">{t('رضا (4★ فأكثر)', 'Satisfied (4★+)')}</div></div>
          <div className="stat-tile"><div className="val eng">{pct(perf.recommend_pct)}</div><div className="lbl">{t('يوصون به', 'Would recommend')}</div></div>
          <div className="stat-tile"><div className="val eng">{pct(perf.rebook_pct)}</div><div className="lbl">{t('أعادوا الحجز', 'Booked again')}</div></div>
        </div>
      )}

      {(strengths.length > 0 || improve.length > 0) && (
        <div className="detail-grid" style={{ marginTop: 12 }}>
          <div>
            <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>{t('نقاط القوة', 'Strengths')}</p>
            <div className="tags-row">
              {strengths.length === 0
                ? <span className="muted" style={{ fontSize: '0.8rem' }}>{t('تظهر بعد ثلاثة تقييمات عالية على الأقل.', 'Shown after at least three high ratings.')}</span>
                : strengths.map((row) => (
                  <span className="tag" key={`${row.source}-${row.criterion}`}>{t(criterionLabel(row.source, row.criterion))} <span className="eng">{row.stars_avg}</span></span>
                ))}
            </div>
          </div>
          <div>
            <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 6 }}>{t('فرص التحسين', 'Room to improve')}</p>
            <div className="tags-row">
              {improve.length === 0
                ? <span className="muted" style={{ fontSize: '0.8rem' }}>{t('لا شيء تحت 4 نجوم.', 'Nothing under four stars.')}</span>
                : improve.map((row) => (
                  <span className="tag" key={`${row.source}-${row.criterion}`}>{t(criterionLabel(row.source, row.criterion))} <span className="eng">{row.stars_avg}</span></span>
                ))}
            </div>
          </div>
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.74rem', marginTop: 8 }}>
        {t('محسوبة من معايير التقييم نفسها، لا حكماً على الشخص. السمعة طويلة المدى في الجواز المهني.',
           'Read off the rating criteria themselves — not a verdict on the person. Long-term reputation lives on the passport.')}
      </p>

      {isSelf && comments.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="muted" style={{ fontSize: '0.86rem' }}>{t(`ما كتبه الناس (${comments.length}) — تراه أنت فقط`, `What people wrote (${comments.length}) — only you see this`)}</summary>
          <ul className="admin-mini-list" style={{ marginTop: 8 }}>
            {comments.map((row, index) => (
              <li key={index} style={{ display: 'block' }}>
                <span className="eng">{row.stars}★</span>
                {row.recommend !== null && <> · {row.recommend ? t('يوصي', 'Recommends') : t('لا يوصي', 'Would not recommend')}</>}
                {row.liked_ar && <p style={{ fontSize: '0.84rem' }}>👍 {row.liked_ar}</p>}
                {row.improve_ar && <p style={{ fontSize: '0.84rem' }}>🔧 {row.improve_ar}</p>}
                {row.comment_ar && <p className="muted" style={{ fontSize: '0.82rem' }}>{row.comment_ar}</p>}
              </li>
            ))}
          </ul>
          <AskAI prompt={aiPrompt} label={t('لخّص الملاحظات بالذكاء', 'Summarise with AI')} />
        </details>
      )}
    </section>
  );
}
