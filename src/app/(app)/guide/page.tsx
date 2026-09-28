import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { money } from '@/lib/booking';

export const metadata = { title: 'Ratings & levels guide — TechMood' };

/**
 * How TechMood judges and how people move up — written once, with every
 * number read from the tables that decide it, so the guide cannot drift from
 * the rules.
 */
export default async function GuidePage() {
  const t = await getT();
  const supabase = await createClient();

  const [{ data: levels }, { data: xpRules }, { data: xpLevels }, { data: questions }] = await Promise.all([
    supabase.from('mentor_levels')
      .select('level, min_session_usd, session_price_usd, max_session_usd, commission_pct, min_sessions, min_rating, sort_order')
      .order('sort_order'),
    supabase.from('xp_rules').select('source, base_xp, per_star_xp, description_ar'),
    supabase.from('xp_levels').select('min_xp, title_ar, sort_order').order('sort_order'),
    supabase.from('level_upgrade_questions').select('key, question_ar, sort_order').eq('is_active', true).order('sort_order'),
  ]);

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.25rem' }}>{t('دليل التقييمات والترقيات', 'Ratings & levels guide')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '70ch' }}>
          {t('كيف تُقيَّم الأعمال والجلسات في TechMood، وكيف تُكسب النقاط والمستويات. كل رقم هنا مقروء من القواعد نفسها التي تطبّقها المنصة.',
             'How work and sessions are judged on TechMood, and how points and levels are earned. Every number here is read from the rules the platform applies.')}
        </p>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>⭐ {t('تقييم الأعمال', 'How work is judged')}</h3>
        <ul className="guide-list">
          <li>{t('كل تسليم يراجعه منتور بشري ويمنحه من 1 إلى 5 نجوم مع ملاحظات مكتوبة. كل مراجعة محفوظة ولا تُمحى بإعادة التسليم.', 'Every hand-in is reviewed by a human mentor, 1 to 5 stars with written notes. Every review is kept; resubmitting never erases one.')}</li>
          <li>{t('لك حق طلب إعادة تقييم بسبب مكتوب، ويذهب الطلب لمنتور آخر.', 'You may ask for a re-evaluation with a written reason; it goes to another mentor.')}</li>
          <li>{t('شهادة الدورة بعد اعتماد كل مهامها ومشروعها؛ شهادة المسار بعد كل دوراته ومشروعه الجماعي.', 'A course certificate follows approval of all its tasks and its project; a path certificate, all its courses and its group project.')}</li>
          <li>{t('المشروع يُسلَّم برابط المشروع نفسه؛ فيديو الشرح على YouTube اختياري.', 'A project is handed in with its own link; a YouTube walkthrough is optional.')}</li>
        </ul>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>🎓 {t('تقييم الجلسات', 'How sessions are rated')}</h3>
        <ul className="guide-list">
          <li>{t('الطرفان يقيّمان بعضهما على معايير (الوضوح، الفائدة، الالتزام…)، والتقييم مغلق حتى يكتب الطرفان أو تمرّ مهلة الأسبوع.', 'Both sides rate each other on criteria (clarity, usefulness, commitment…); ratings stay sealed until both have written or the week has passed.')}</li>
          <li>{t('مهلة التقييم أسبوع من نهاية الجلسة، ثم يُغلق.', 'You have a week from the end of the session to rate; then it closes.')}</li>
          <li>{t('إن طلب الطالب مراجعة عمل، فتقييم المنتور المكتوب إلزامي، وتبقى حصته محجوزة حتى يكتبه. فوات المهلة يُسجَّل في أدائه.', 'If the learner asked for a review, the mentor’s written evaluation is required and their share is held until they write it. Missing the week is recorded against them.')}</li>
          <li>{t('متوسط تقييم المنتور يحدّد أهليته للترقية، ويظهر في السوق والإرشاد.', 'A mentor’s average rating decides their eligibility to move up, and shows in mentoring and the market.')}</li>
        </ul>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>✨ {t('نقاط الخبرة (XP)', 'Experience points (XP)')}</h3>
        <table className="data" style={{ marginTop: 10 }}>
          <thead><tr><th>{t('ما تكسب به', 'Earned for')}</th><th>{t('النقاط', 'Points')}</th></tr></thead>
          <tbody>
            {(xpRules ?? []).filter((rule) => rule.base_xp > 0 || rule.per_star_xp > 0).map((rule) => (
              <tr key={rule.source}>
                <td>{rule.description_ar}</td>
                <td className="eng">
                  {rule.per_star_xp > 0
                    ? `${rule.per_star_xp} × ★ (${rule.per_star_xp}–${rule.per_star_xp * 5})`
                    : rule.base_xp}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="tags-row" style={{ marginTop: 12 }}>
          {(xpLevels ?? []).map((level) => (
            <span className="badge-pill" key={level.sort_order}>{level.title_ar} · <span className="eng">{level.min_xp}+</span></span>
          ))}
        </div>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>🧭 {t('مستويات المنتورز', 'Mentor levels')}</h3>
        <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
          {t('كل منتور جديد يبدأ من المستوى الأول. نطاق السعر لساعة جلسة، ونسبة TechMood منه.', 'Every new mentor starts at level 1. Price range per session hour, and TechMood’s share of it.')}
        </p>
        <table className="data" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>{t('المستوى', 'Level')}</th>
              <th>{t('نطاق السعر', 'Price range')}</th>
              <th>{t('نسبة المنصة', 'Platform share')}</th>
              <th>{t('الجلسات المطلوبة', 'Sessions needed')}</th>
              <th>{t('أقل تقييم', 'Minimum rating')}</th>
            </tr>
          </thead>
          <tbody>
            {(levels ?? []).map((level) => (
              <tr key={level.level}>
                <td className="eng">{level.level}</td>
                <td className="eng">{money(level.min_session_usd)} – {money(level.max_session_usd)}</td>
                <td className="eng">{Number(level.commission_pct)}%</td>
                <td className="eng">{level.min_sessions}</td>
                <td className="eng">{Number(level.min_rating) > 0 ? `★ ${level.min_rating}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4 style={{ fontSize: '0.92rem', marginTop: 14 }}>{t('كيف تترقّى', 'How to move up')}</h4>
        <ol className="guide-list">
          <li>{t('تبلغ جلسات وتقييم المستوى التالي — يظهر تقدّمك في «مستواي».', 'Reach the next level’s sessions and rating — your progress shows in “My level”.')}</li>
          <li>{t('تجيب عن استبيان الترقية:', 'Answer the upgrade questionnaire:')}
            <ul>{(questions ?? []).map((q) => <li key={q.key}>{q.question_ar}</li>)}</ul>
          </li>
          <li>{t('تقرأ الإدارة الإجابات مع أرقامك وتوافق أو تعتذر بسبب مكتوب. بالموافقة يتّسع نطاق أسعارك.', 'TechMood reads the answers with your numbers and approves or declines with a written reason. Approved, your price range widens.')}</li>
        </ol>
        <Link className="btn btn-ghost btn-sm" href="/mentor-requests/level" style={{ marginTop: 10 }}>{t('مستواي', 'My level')}</Link>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>🛒 {t('السوق والثقة', 'Market & trust')}</h3>
        <ul className="guide-list">
          <li>{t('كل عرض في السوق تراجعه الإدارة قبل ظهوره؛ العرض المرفوض يُحذف ويُسجَّل تنبيه على البائع.', 'Every market listing is checked before it shows; a refused one is removed and a warning is recorded on the seller.')}</li>
          <li>{t('رابط التسليم يبقى مخفياً حتى تتأكد TechMood من الدفع.', 'The delivery link stays hidden until TechMood confirms the payment.')}</li>
          <li>{t('عمولة بيع المشروع 15%، وعمولة الجلسات 30% (33% في المستوى الأول).', 'Project sales carry a 15% commission; sessions 30% (33% at level 1).')}</li>
        </ul>
      </section>
    </>
  );
}
