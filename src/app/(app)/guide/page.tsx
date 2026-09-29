import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { money } from '@/lib/booking';

export const generateMetadata = localizedTitle('دليل التقييمات والمستويات — TechMood', 'Ratings & levels guide — TechMood');

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
      .select('level, title, badge, fits_ar, fits_en, min_session_usd, session_price_usd, max_session_usd, commission_pct, min_sessions, min_rating, sort_order')
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
          <li>{t('متوسط تقييم المنتور يظهر في الإرشاد والسوق، وهو جزء مما تقرؤه الإدارة عند طلب الترقية — لا يرقّي أحداً وحده.', 'A mentor’s average rating shows in mentoring and the market, and is part of what TechMood reads on an upgrade request — it never moves anyone up on its own.')}</li>
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
          {t('ثلاثة مستويات. المستوى يحدد نطاق السعر المسموح به لساعة الجلسة، والمنتور يحدد سعره داخله حسب خبرته ونوع الجلسة. يبدأ المنتور الجديد من Peer / Junior ما لم تحدّد الإدارة مستوى أعلى عند اعتماده.',
             'Three levels. A level sets the allowed price range for a session hour; the mentor names their own price inside it by their experience and the kind of session. A new mentor starts at Peer / Junior unless TechMood places them higher on approval.')}
        </p>
        <table className="data" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>{t('المستوى', 'Level')}</th>
              <th>{t('نطاق السعر', 'Price range')}</th>
              <th>{t('نسبة المنصة', 'Platform share')}</th>
              <th>{t('لمن', 'For whom')}</th>
            </tr>
          </thead>
          <tbody>
            {(levels ?? []).map((level) => (
              <tr key={level.level}>
                <td className="eng" style={{ whiteSpace: 'nowrap' }}>{level.badge} {level.title}</td>
                <td className="eng" style={{ whiteSpace: 'nowrap' }}>{money(level.min_session_usd)} – {money(level.max_session_usd)}</td>
                <td className="eng">{Number(level.commission_pct)}%</td>
                <td style={{ fontSize: '0.82rem' }}>{t(level.fits_ar ?? '', level.fits_en ?? level.fits_ar ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4 style={{ fontSize: '0.92rem', marginTop: 14 }}>{t('كيف تترقّى', 'How to move up')}</h4>
        <ol className="guide-list">
          <li>{t('من «مستواي» تضغط «طلب ترقية المستوى» — مستوى واحد في كل مرة: Peer / Junior ← Professional ← Senior / Specialist.', 'From “My level” you press “Request a level upgrade” — one level at a time: Peer / Junior → Professional → Senior / Specialist.')}</li>
          <li>{t('تجيب عن استبيان الترقية:', 'Answer the upgrade questionnaire:')}
            <ul>{(questions ?? []).map((q) => <li key={q.key}>{q.question_ar}</li>)}</ul>
          </li>
          <li>{t('تراجع الإدارة الطلب على الصورة كاملة: الخبرة، التخصص، الأعمال والمشاريع، التقييمات، وسجل الجلسات — لا بعدد النجوم وحده. وتوافق أو تعتذر بسبب مكتوب يصلك. بالموافقة ينتقل نطاق السعر المسموح لك إلى نطاق المستوى الجديد.', 'TechMood reviews the request on the whole picture: experience, specialty, works and projects, ratings and the sessions record — never on stars alone — and approves or declines with a written reason you receive. Approved, your allowed price range becomes the new level’s.')}</li>
          <li>{t('بعد الرفض تنتظر مدة قصيرة قبل أن تطلب من جديد، وترى الموعد في «مستواي».', 'After a decline there is a short wait before you can ask again; “My level” shows the date.')}</li>
        </ol>
        <Link className="btn btn-ghost btn-sm" href="/mentor-requests/level" style={{ marginTop: 10 }}>{t('مستواي', 'My level')}</Link>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>🛒 {t('السوق والثقة', 'Market & trust')}</h3>
        <ul className="guide-list">
          <li>{t('كل عرض في السوق تراجعه الإدارة قبل ظهوره؛ العرض المرفوض يُحذف ويُسجَّل تنبيه على البائع.', 'Every market listing is checked before it shows; a refused one is removed and a warning is recorded on the seller.')}</li>
          <li>{t('رابط التسليم يبقى مخفياً حتى تتأكد TechMood من الدفع.', 'The delivery link stays hidden until TechMood confirms the payment.')}</li>
          <li>{t('عمولة بيع المشروع 15%، وعمولة الجلسات 30% (33% في مستوى Peer / Junior).', 'Project sales carry a 15% commission; sessions 30% (33% at Peer / Junior).')}</li>
        </ul>
      </section>
    </>
  );
}
