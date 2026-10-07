import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';
import { avatarColor, initialOf } from '@/lib/mentor-look';

export type LeagueMetric = 'points' | 'streak' | 'rating';
export type LeagueWindow = 'today' | 'week' | 'month' | 'year' | 'all';
export type LeagueQuery = { metric: LeagueMetric; window: LeagueWindow; path: string | null };

const METRICS: { key: LeagueMetric; label: Text; icon: string }[] = [
  { key: 'points', label: { ar: 'النقاط', en: 'Points' }, icon: '⚡' },
  { key: 'streak', label: { ar: 'الحماسة', en: 'Streak' }, icon: '🔥' },
  { key: 'rating', label: { ar: 'التقييم', en: 'Rating' }, icon: '⭐' },
];

const WINDOWS: { key: LeagueWindow; label: Text }[] = [
  { key: 'today', label: { ar: 'اليوم', en: 'Today' } },
  { key: 'week',  label: { ar: 'الأسبوع', en: 'Week' } },
  { key: 'month', label: { ar: 'الشهر', en: 'Month' } },
  { key: 'year',  label: { ar: 'السنة', en: 'Year' } },
  { key: 'all',   label: { ar: 'الكل', en: 'All' } },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function parseLeague(params: { lm?: string; lw?: string; lp?: string }): LeagueQuery {
  const metric = METRICS.some((m) => m.key === params.lm) ? (params.lm as LeagueMetric) : 'points';
  const window = WINDOWS.some((w) => w.key === params.lw) ? (params.lw as LeagueWindow) : 'week';
  const path = params.lp && /^[0-9a-f-]{36}$/.test(params.lp) ? params.lp : null;
  return { metric, window, path };
}

/**
 * The students' league (0110): students only, read by points, by streak or
 * by rating — never one figure mixing them — over a window, across everybody
 * or within one of the student's paths.
 */
export async function League({
  query,
  paths,
}: {
  query: LeagueQuery;
  paths: { id: string; title: string }[];
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc('student_league', {
    p_metric: query.metric, p_window: query.window, p_path: query.path, p_limit: 10,
  });
  const rows = data ?? [];
  const top = rows.filter((row) => row.rank <= 10);
  const me = rows.find((row) => row.is_me);
  const meOutside = me && me.rank > 10 ? me : null;

  const href = (next: Partial<LeagueQuery>) => {
    const q = { ...query, ...next };
    const params = new URLSearchParams({ lm: q.metric, lw: q.window });
    if (q.path) params.set('lp', q.path);
    return `/home?${params.toString()}#leaderboard`;
  };

  const scoreOf = (row: (typeof rows)[number]) =>
    query.metric === 'points' ? `${row.points} XP`
      : query.metric === 'streak' ? t(`${row.streak} ${row.streak === 1 ? 'يوم' : 'أيام'}`, `${row.streak} ${row.streak === 1 ? 'day' : 'days'}`)
        : `★ ${Number(row.stars ?? 0).toFixed(1)}`;

  const detailOf = (row: (typeof rows)[number]) =>
    query.metric === 'rating'
      ? t(`${row.rated} عمل مُقيَّم`, `${row.rated} rated`)
      : query.metric === 'streak'
        ? t('أيام متتالية حتى اليوم', 'days in a row')
        : row.stars ? `★ ${Number(row.stars).toFixed(1)}` : t('بلا تقييم بعد', 'not rated yet');

  const renderRow = (row: (typeof rows)[number]) => (
    <li key={row.profile_id} className={`${row.rank <= 3 ? `is-top is-${row.rank}` : ''}${row.is_me ? ' is-me' : ''}`}>
      <span className="hm-rank">{MEDAL[row.rank] ?? row.rank}</span>
      <span className="hm-rank-avatar" style={{ background: avatarColor(row.profile_id) }} aria-hidden="true">
        {row.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={row.avatar_url} alt="" />
          : initialOf(row.name)}
      </span>
      <span className="hm-rank-name">
        <strong>{row.is_me ? t('أنت', 'You') : row.name}</strong>
        <span className="muted">{detailOf(row)}</span>
      </span>
      <span className={`hm-rank-xp is-${query.metric}`} dir={query.metric === 'streak' ? undefined : 'ltr'}>{scoreOf(row)}</span>
    </li>
  );

  return (
    <article className="hm-card hm-league" id="leaderboard">
      <div className="hm-card-head">
        <h3>🏆 {t('دوري الطلاب', 'Student league')}</h3>
        {me && <span className="hm-myrank">{t('ترتيبك ', 'You are ')}<strong>#{me.rank}</strong></span>}
      </div>

      <nav className="hm-seg" aria-label={t('رتّب حسب', 'Rank by')}>
        {METRICS.map((metric) => (
          <Link key={metric.key} href={href({ metric: metric.key })} scroll={false}
                className={query.metric === metric.key ? 'is-on' : ''} aria-current={query.metric === metric.key ? 'true' : undefined}>
            <span aria-hidden="true">{metric.icon}</span> {t(metric.label)}
          </Link>
        ))}
      </nav>

      {query.metric === 'streak' ? (
        <p className="hm-league-note">{t('الأيام المتتالية حتى اليوم — يوم أنجزت فيه شيئاً.', 'Days in a row, up to today, with something finished.')}</p>
      ) : (
        <nav className="hm-windows" aria-label={t('الفترة', 'Period')}>
          {WINDOWS.map((window) => (
            <Link key={window.key} href={href({ window: window.key })} scroll={false}
                  className={query.window === window.key ? 'is-on' : ''} aria-current={query.window === window.key ? 'true' : undefined}>
              {t(window.label)}
            </Link>
          ))}
        </nav>
      )}

      {paths.length > 0 && (
        <nav className="hm-scope" aria-label={t('النطاق', 'Scope')}>
          <Link href={href({ path: null })} scroll={false} className={!query.path ? 'is-on' : ''}>
            {t('عام', 'Everyone')}
          </Link>
          {paths.map((path) => (
            <Link key={path.id} href={href({ path: path.id })} scroll={false}
                  className={query.path === path.id ? 'is-on' : ''} title={path.title}>
              {path.title}
            </Link>
          ))}
        </nav>
      )}

      {top.length === 0 ? (
        <p className="muted" style={{ padding: '10px 2px', fontSize: '0.85rem' }}>
          {t('لا أحد في هذا الترتيب بعد — كن الأول.', 'Nobody here yet — be the first.')}
        </p>
      ) : (
        <ol className="hm-ranks" tabIndex={0} aria-label={t('الترتيب', 'Ranking')}>
          {/* zones (design lab 3): the top three above a line, everyone else below it */}
          <li className="hm-zone is-up" aria-hidden="true">▲ {t('منطقة الصدارة', 'The top three')}</li>
          {top.filter((row) => row.rank <= 3).map(renderRow)}
          {top.some((row) => row.rank > 3) && (
            <li className="hm-zone is-line" aria-hidden="true">
              <span>
                {me && me.rank > 3 && top.find((row) => row.rank === 3) && query.metric !== 'rating'
                  ? t(`تحتاج ${Math.max(1, Number(top.find((row) => row.rank === 3)!.score) - Number(me.score) + 1)} ${query.metric === 'points' ? 'XP' : 'يوماً'} لتدخل الصدارة`,
                      `${Math.max(1, Number(top.find((row) => row.rank === 3)!.score) - Number(me.score) + 1)} ${query.metric === 'points' ? 'XP' : 'days'} more to reach the top three`)
                  : t('خط الصدارة', 'The top-three line')}
              </span>
            </li>
          )}
          {top.filter((row) => row.rank > 3).map(renderRow)}
          {meOutside && (
            <>
              <li className="hm-ranks-gap" aria-hidden="true">⋯</li>
              {renderRow(meOutside)}
            </>
          )}
        </ol>
      )}
    </article>
  );
}
