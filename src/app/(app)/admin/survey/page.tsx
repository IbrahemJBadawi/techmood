import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';
import type { Text } from '@/lib/i18n';

import { MOST_USED, PAINS } from '../../survey/options';

export const generateMetadata = localizedTitle('استبيان التجربة — الإدارة', 'Experience survey — Admin');

type Stats = {
  responses: number; all_time: number; ease_avg: number | null; recommend_avg: number | null; nps: number | null;
  promoters: number; passives: number; detractors: number;
  ease: Record<string, number>; most_used: Record<string, number>; pains: Record<string, number>; roles: Record<string, number>;
  weekly: { week: string; n: number; ease: number }[];
  suggestions: { text: string; ease: number; recommend: number; role: string | null; at: string }[];
};

const WINDOWS = [30, 90, 365];

/** One horizontal bar per answer, one hue, the count written beside it. */
function Bars({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((row) => row.n));
  return (
    <ul className="sv-bars">
      {rows.map((row) => (
        <li key={row.label} title={`${row.label}: ${row.n}${total ? ` (${Math.round((row.n / total) * 100)}%)` : ''}`}>
          <span className="sv-bar-label">{row.label}</span>
          <span className="sv-bar-track"><span className="sv-bar-fill" style={{ width: `${(row.n / max) * 100}%` }} /></span>
          <span className="sv-bar-value eng">{row.n}{total ? <small> · {Math.round((row.n / total) * 100)}%</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminSurveyPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const days = WINDOWS.includes(Number((await searchParams).d)) ? Number((await searchParams).d) : 90;
  const { data } = await supabase.rpc('ux_survey_stats', { p_days: days });
  const s = (data ?? {}) as unknown as Stats;
  const n = s.responses ?? 0;
  const label = (list: { key: string; label: Text }[], key: string) => {
    const hit = list.find((item) => item.key === key);
    return hit ? t(hit.label) : key;
  };
  const sorted = (record: Record<string, number> | undefined) =>
    Object.entries(record ?? {}).sort((a, b) => b[1] - a[1]);
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'medium' });
  const npsTone = s.nps == null ? '' : s.nps >= 30 ? 'is-good' : s.nps >= 0 ? 'is-mid' : 'is-bad';

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>📝 {t('استبيان تجربة المستخدم', 'User experience survey')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('بطاقة دائمة تدعو كل عضو للاستبيان حتى يجيب، ثم كل 90 يوماً. هنا المجاميع فقط، واقتراحات الأعضاء نصّاً.',
             'A standing card invites every member until they answer, then every 90 days. Totals only here, plus the members’ suggestions.')}
        </p>
        <nav className="hm-windows" aria-label={t('الفترة', 'Period')} style={{ marginTop: 10 }}>
          {WINDOWS.map((w) => (
            <Link key={w} href={`/admin/survey?d=${w}`} className={days === w ? 'is-on' : ''} aria-current={days === w ? 'true' : undefined}>
              {t(`آخر ${w} يوماً`, `Last ${w} days`)}
            </Link>
          ))}
        </nav>
      </section>

      <div className="sv-tiles section-block">
        <div className="hm-card sv-tile"><strong className="eng">{n}</strong><span>{t('إجابات في الفترة', 'Answers in the period')}</span><small className="muted">{t(`${s.all_time ?? 0} منذ البداية`, `${s.all_time ?? 0} all time`)}</small></div>
        <div className={`hm-card sv-tile ${npsTone}`}><strong className="eng">{s.nps ?? '—'}</strong><span>NPS</span><small className="muted">{t('من −100 إلى +100', 'from −100 to +100')}</small></div>
        <div className="hm-card sv-tile"><strong className="eng">{s.ease_avg ?? '—'}<small>/5</small></strong><span>{t('سهولة الاستخدام', 'Ease of use')}</span></div>
        <div className="hm-card sv-tile"><strong className="eng">{s.recommend_avg ?? '—'}<small>/10</small></strong><span>{t('احتمال التوصية', 'Likely to recommend')}</span></div>
      </div>

      {n === 0 ? (
        <div className="panel empty-state section-block"><h3 style={{ fontSize: '0.98rem' }}>{t('لا إجابات في هذه الفترة بعد', 'No answers in this period yet')}</h3></div>
      ) : (
        <div className="sv-grid section-block">
          <section className="panel">
            <h3>{t('من يوصي؟', 'Who recommends?')}</h3>
            <Bars total={n} rows={[
              { label: t('مروّجون (9–10)', 'Promoters (9–10)'), n: s.promoters },
              { label: t('محايدون (7–8)', 'Passives (7–8)'), n: s.passives },
              { label: t('منتقدون (0–6)', 'Detractors (0–6)'), n: s.detractors },
            ]} />
          </section>
          <section className="panel">
            <h3>{t('سهولة الاستخدام', 'Ease of use')}</h3>
            <Bars total={n} rows={['5', '4', '3', '2', '1'].map((k) => ({ label: `${k} ★`, n: s.ease?.[k] ?? 0 }))} />
          </section>
          <section className="panel">
            <h3>{t('الأكثر استخداماً', 'Used most')}</h3>
            <Bars total={n} rows={sorted(s.most_used).map(([k, v]) => ({ label: label(MOST_USED, k), n: v }))} />
          </section>
          <section className="panel">
            <h3>{t('ما يعيق الأعضاء', 'What gets in the way')}</h3>
            <Bars total={n} rows={sorted(s.pains).map(([k, v]) => ({ label: label(PAINS, k), n: v }))} />
          </section>
          <section className="panel">
            <h3>{t('حسب الدور', 'By role')}</h3>
            <Bars total={n} rows={sorted(s.roles).map(([k, v]) => ({ label: k, n: v }))} />
          </section>
          <section className="panel">
            <h3>{t('الإجابات أسبوعياً', 'Answers per week')}</h3>
            <Bars total={0} rows={(s.weekly ?? []).map((row) => ({ label: `${date.format(new Date(row.week))} · ${row.ease}★`, n: row.n }))} />
          </section>
        </div>
      )}

      {(s.suggestions ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>💡 {t('اقتراحات الأعضاء', 'Members’ suggestions')}</h3>
          <ul className="sv-suggestions">
            {s.suggestions.map((row, index) => (
              <li key={index}>
                <p>{row.text}</p>
                <span className="muted">
                  <bdi>{row.ease}★</bdi> · {t('توصية', 'recommend')} <bdi>{row.recommend}/10</bdi>
                  {row.role && <> · <bdi>{row.role}</bdi></>} · <bdi>{date.format(new Date(row.at))}</bdi>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
