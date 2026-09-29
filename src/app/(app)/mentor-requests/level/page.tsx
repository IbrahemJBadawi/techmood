import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { money } from '@/lib/booking';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { UpgradeForm } from './UpgradeForm';

export const generateMetadata = localizedTitle('مستواي — TechMood', 'My level — TechMood');

/**
 * A mentor's level and the way up (0101, 0120).
 *
 * Three levels, each an allowed price range; the mentor prices inside it. The
 * next level's sessions and rating are shown as a guide — the request is open
 * whenever there is no request waiting and no wait after a decline, and the
 * admin decides on experience, specialty, works, ratings and sessions together.
 */
export default async function MentorLevelPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: rows }, { data: questions }, { data: levels }] = await Promise.all([
    supabase.rpc('my_level_progress'),
    supabase.from('level_upgrade_questions').select('key, question_ar, hint_ar, min_chars, needs_link').eq('is_active', true).order('sort_order'),
    supabase.from('mentor_levels')
      .select('level, title, badge, fits_ar, fits_en, min_session_usd, max_session_usd, sort_order')
      .order('sort_order'),
  ]);
  const p = rows?.[0];

  if (!p?.current_level) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمنتورز المعتمدين.', 'This page is for approved mentors.')}</p>;
  }

  const sessionsPct = p.sessions_guide ? Math.min(100, Math.round(((p.sessions_count ?? 0) / p.sessions_guide) * 100)) : 100;
  const opensOn = p.opens_at
    ? new Date(p.opens_at).toLocaleDateString(t.locale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeZone: PLATFORM_TIME_ZONE })
    : null;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/mentor-requests">{t('→ طلبات الجلسات', '← Session requests')}</Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('مستواي', 'My level')}: <span className="eng">{p.current_title}</span></h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6, maxWidth: '70ch' }}>
          {t('المستوى يحدد نطاق السعر المسموح به، وأنت تحدد سعرك داخله من ',
             'A level sets the allowed price range; you name your own price inside it, from ')}
          <Link href="/mentor-requests/pricing">{t('أسعاري', 'My prices')}</Link>.
          {t(' التفاصيل في ', ' Details in ')}
          <Link href="/guide">{t('دليل التقييمات والترقيات', 'the ratings & levels guide')}</Link>.
        </p>
      </section>

      {/* The three levels, the mentor's own highlighted. */}
      <section className="card-grid section-block">
        {(levels ?? []).map((level) => (
          <article className={`panel${level.level === p.current_level ? ' is-current' : ''}`} key={level.level}
                   style={level.level === p.current_level ? { outline: '2px solid var(--mentor)' } : undefined}>
            <h3 style={{ fontSize: '1rem' }}>{level.badge} <span className="eng">{level.title}</span></h3>
            <p className="eng" style={{ fontWeight: 700, marginTop: 4 }}>
              {money(level.min_session_usd)} – {money(level.max_session_usd)} <span className="muted" style={{ fontWeight: 400 }}>{t('/ ساعة', '/ hour')}</span>
            </p>
            {(level.fits_ar || level.fits_en) && (
              <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>{t(level.fits_ar ?? '', level.fits_en ?? level.fits_ar ?? '')}</p>
            )}
            {level.level === p.current_level && <span className="status-pill status-ok" style={{ marginTop: 8 }}>{t('مستواك', 'Your level')}</span>}
          </article>
        ))}
      </section>

      {!p.next_level ? (
        <p className="notice notice-ok">{t('أنت في أعلى مستوى.', 'You are at the top level.')}</p>
      ) : (
        <section className="panel section-block">
          <h3 style={{ fontSize: '1rem' }}>{t('نحو ', 'Towards ')}<span className="eng">{p.next_title}</span></h3>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            {t('أرقام استرشادية تراها الإدارة بجانب طلبك — ليست شرطاً لتقديمه.',
               'Guide numbers TechMood sees beside your request — not a condition for sending it.')}
          </p>
          <div className="stat-tiles" style={{ marginTop: 10 }}>
            <div className="stat-tile">
              <div className="val eng">{p.sessions_count ?? 0} / {p.sessions_guide}</div>
              <div className="lbl">{t('جلسات مكتملة', 'Sessions held')} · <span className="eng">{sessionsPct}%</span></div>
            </div>
            <div className="stat-tile">
              <div className="val eng">★ {p.rating_avg ?? '—'} / {p.rating_guide}</div>
              <div className="lbl">{t('متوسط التقييم', 'Average rating')}</div>
            </div>
          </div>
        </section>
      )}

      {p.pending_request && (
        <p className="notice section-block">{t('طلب ترقيتك قيد مراجعة الإدارة، ويصلك القرار وسببه في الإشعارات.', 'Your upgrade request is with TechMood; the decision and its reason reach your notifications.')}</p>
      )}
      {!p.pending_request && p.last_status === 'declined' && (
        <p className="notice notice-danger section-block">
          {t('لم يُقبل الطلب السابق', 'The previous request was declined')}{p.last_note ? `: ${p.last_note}` : ''}
          {opensOn && <>{' — '}{t(`يمكنك الطلب من جديد في ${opensOn}.`, `You can ask again on ${opensOn}.`)}</>}
        </p>
      )}
      {!p.pending_request && p.last_status === 'approved' && p.last_note && (
        <p className="notice notice-ok section-block">{t('ملاحظة الإدارة على ترقيتك', 'TechMood’s note on your upgrade')}: {p.last_note}</p>
      )}

      {p.next_level && p.eligible && <UpgradeForm questions={questions ?? []} />}
    </>
  );
}
