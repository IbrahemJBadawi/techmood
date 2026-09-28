import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { UpgradeForm } from './UpgradeForm';

export const metadata = { title: 'My level — TechMood' };

/** Where a mentor stands against the next level, and the way to ask (0101). */
export default async function MentorLevelPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: rows }, { data: questions }] = await Promise.all([
    supabase.rpc('my_level_progress'),
    supabase.from('level_upgrade_questions').select('key, question_ar, hint_ar, min_chars').eq('is_active', true).order('sort_order'),
  ]);
  const p = rows?.[0];

  if (!p?.current_level) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمنتورز المعتمدين.', 'This page is for approved mentors.')}</p>;
  }

  const sessionsPct = p.sessions_needed ? Math.min(100, Math.round(((p.sessions_count ?? 0) / p.sessions_needed) * 100)) : 100;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/mentor-requests">{t('→ طلبات الجلسات', '← Session requests')}</Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('مستواي', 'My level')}: <span className="eng">{p.current_level}</span></h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('المستوى يُكسب بالجلسات والتقييم، ثم تطلبه باستبيان تقرؤه الإدارة. التفاصيل في ', 'A level is earned with sessions and rating, then asked for with a questionnaire TechMood reads. Details in ')}
          <Link href="/guide">{t('دليل التقييمات والترقيات', 'the ratings & levels guide')}</Link>.
        </p>
      </section>

      {!p.next_level ? (
        <p className="notice notice-ok">{t('أنت في أعلى مستوى.', 'You are at the top level.')}</p>
      ) : (
        <section className="panel section-block">
          <h3 style={{ fontSize: '1rem' }}>{t('نحو ', 'Towards ')}<span className="eng">{p.next_level}</span></h3>
          <div className="stat-tiles" style={{ marginTop: 10 }}>
            <div className="stat-tile">
              <div className="val eng">{p.sessions_count ?? 0} / {p.sessions_needed}</div>
              <div className="lbl">{t('جلسات مكتملة', 'Sessions held')} · <span className="eng">{sessionsPct}%</span></div>
            </div>
            <div className="stat-tile">
              <div className="val eng">★ {p.rating_avg ?? '—'} / {p.rating_needed}</div>
              <div className="lbl">{t('متوسط التقييم', 'Average rating')}</div>
            </div>
          </div>
        </section>
      )}

      {p.pending_request && (
        <p className="notice section-block">{t('طلب ترقيتك قيد المراجعة.', 'Your upgrade request is under review.')}</p>
      )}
      {!p.pending_request && p.last_status === 'declined' && (
        <p className="notice notice-danger section-block">
          {t('لم يُقبل الطلب السابق', 'The previous request was declined')}{p.last_note ? `: ${p.last_note}` : ''}
        </p>
      )}

      {p.next_level && !p.pending_request && (p.eligible
        ? <UpgradeForm questions={questions ?? []} />
        : <p className="notice">{t('يُفتح الاستبيان حين تبلغ جلسات وتقييم المستوى التالي.', 'The questionnaire opens once you reach the next level’s sessions and rating.')}</p>)}
    </>
  );
}
