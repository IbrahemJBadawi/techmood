import Link from 'next/link';

import { MemberAvatar } from '@/components/MemberAvatar';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

/**
 * The week's four challenges (0128), with how far along each one is and how
 * long is left. All four in one week earns "Week champion".
 */
export async function WeeklyChallenges() {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_challenges');
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const done = rows.filter((row) => row.progress >= row.goal).length;
  const daysLeft = rows[0].days_left;

  return (
    <section className="section-block">
      <div className="hm-head">
        <h2>{t('تحديات الأسبوع', 'This week’s challenges')}</h2>
        <span className="muted" style={{ fontSize: '0.82rem' }}>
          {t(`${done} من 4 · يتجدد بعد ${daysLeft} يوم`, `${done} of 4 · renews in ${daysLeft} days`)}
        </span>
      </div>
      <div className="ch-grid">
        {rows.map((row) => {
          const pct = Math.min(Math.round((row.progress / row.goal) * 100), 100);
          const complete = row.progress >= row.goal;
          return (
            <div className={`ch-card${complete ? ' is-done' : ''}`} key={row.key}>
              <span className="ch-icon" aria-hidden="true">{complete ? '✅' : row.icon}</span>
              <span className="ch-body">
                <strong>{t(row.title_ar, row.title_en)}</strong>
                <span className="ch-bar" role="progressbar" aria-valuemin={0} aria-valuemax={row.goal}
                      aria-valuenow={Math.min(row.progress, row.goal)} aria-label={t(row.title_ar, row.title_en)}>
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="muted eng">{Math.min(row.progress, row.goal)} / {row.goal}</span>
              </span>
            </div>
          );
        })}
      </div>
      {done === 4 && (
        <p className="notice notice-ok" style={{ marginTop: 10 }}>
          🏆 {t('أنهيت تحديات هذا الأسبوع — أنت بطل الأسبوع!', 'You finished this week’s challenges — Week champion!')}
        </p>
      )}
    </section>
  );
}

const FEED_LINE: Record<string, { ar: (title: string, detail: string | null) => string; en: (title: string, detail: string | null) => string; icon: string }> = {
  lessons:     { icon: '📘', ar: (n) => `أنهى ${n} ${Number(n) === 1 ? 'درساً' : 'دروس'}`, en: (n) => `finished ${n} lesson${Number(n) === 1 ? '' : 's'}` },
  achievement: { icon: '🏅', ar: (title) => `حقّق «${title}»`, en: (title) => `earned “${title}”` },
  certificate: { icon: '🎓', ar: (title) => `نال شهادة ${title ?? ''}`, en: (title) => `earned a certificate: ${title ?? ''}` },
  approved:    { icon: '✅', ar: (title) => `اعتُمد عمله: ${title}`, en: (title) => `had work approved: ${title}` },
  project:     { icon: '🖼️', ar: (title) => `عرض مشروعاً في المعرض: ${title}`, en: (title) => `put a project on show: ${title}` },
};

function ago(iso: string, locale: 'ar' | 'en') {
  const hours = Math.max(Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000), 0);
  if (hours < 1) return locale === 'ar' ? 'الآن' : 'just now';
  if (hours < 24) return locale === 'ar' ? `قبل ${hours} س` : `${hours}h ago`;
  const daysAgo = Math.round(hours / 24);
  return locale === 'ar' ? `قبل ${daysAgo} يوم` : `${daysAgo}d ago`;
}

/**
 * The people I follow (0128): this week's race by XP, and what they finished
 * lately. Someone who follows nobody is shown how to start.
 */
export async function FollowingProgress() {
  const t = await getT();
  const supabase = await createClient();
  const [{ data: race }, { data: feed }] = await Promise.all([
    supabase.rpc('following_week'),
    supabase.rpc('following_feed', { p_limit: 12 }),
  ]);
  const people = race ?? [];
  const followsNobody = people.length <= 1;

  return (
    <section className="section-block">
      <div className="hm-head">
        <h2>{t('من تتابعهم', 'People you follow')}</h2>
        <Link href="/search">{t('ابحث عن زملاء', 'Find classmates')}</Link>
      </div>

      {followsNobody ? (
        <div className="panel empty-state" style={{ padding: 18 }}>
          <p style={{ margin: 0 }}>
            {t('تابع زملاءك من ملفاتهم لترى تقدّمهم هنا، وتتسابقوا على نقاط الأسبوع، وتصلك إنجازاتهم.',
               'Follow classmates from their profiles to see their progress here, race for the week’s XP, and hear about their achievements.')}
          </p>
        </div>
      ) : (
        <div className="fp-layout">
          <ol className="fp-race" aria-label={t('سباق الأسبوع', 'This week’s race')}>
            {people.map((person) => (
              <li key={person.techmood_id} className={person.is_me ? 'is-me' : ''}>
                <span className="fp-rank eng">{person.rank}</span>
                <MemberAvatar id={person.techmood_id} name={person.name} url={person.avatar_url} size={28} />
                <span className="fp-name">
                  {person.is_me ? t('أنت', 'You') : <Link href={`/m/${person.techmood_id}`}>{person.name}</Link>}
                </span>
                {person.streak > 0 && <span className="fp-streak eng" title={t('أيام متتالية', 'Day streak')}>🔥{person.streak}</span>}
                <strong className="fp-xp eng">{person.xp} XP</strong>
              </li>
            ))}
          </ol>

          <ul className="fp-feed">
            {(feed ?? []).length === 0 && (
              <li className="muted">{t('لا جديد ممن تتابعهم هذا الشهر بعد.', 'Nothing new from the people you follow this month yet.')}</li>
            )}
            {(feed ?? []).map((item, index) => {
              const line = FEED_LINE[item.kind];
              if (!line) return null;
              const text = t.locale === 'ar' ? line.ar(item.title ?? '', item.detail) : line.en(item.title ?? '', item.detail);
              return (
                <li key={`${item.kind}-${item.happened_at}-${index}`}>
                  <MemberAvatar id={item.techmood_id} name={item.name} url={item.avatar_url} size={32} />
                  <span className="fp-text">
                    <Link href={`/m/${item.techmood_id}`}><strong>{item.name}</strong></Link>{' '}
                    {item.link ? <Link href={item.link}>{text}</Link> : text}
                    <span className="muted"> · {ago(item.happened_at, t.locale)}</span>
                  </span>
                  <span aria-hidden="true">{item.kind === 'achievement' ? item.detail ?? line.icon : line.icon}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Every achievement: the earned ones in colour first, the ones still ahead greyed (0128). */
export async function AchievementsShelf() {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_achievements');
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const earned = rows.filter((row) => row.awarded_at).length;

  return (
    <div className="ach-shelf" id="achievements">
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
        {t(`${earned} من ${rows.length} إنجازاً`, `${earned} of ${rows.length} achievements`)}
      </p>
      <div className="ach-grid">
        {rows.map((row) => (
          <span className={`ach-item${row.awarded_at ? '' : ' is-locked'}`} key={row.slug}
                title={`${t(row.name_ar, row.name_en ?? row.name_ar)} — ${t(row.description_ar ?? '', row.description_en ?? row.description_ar ?? '')}`}>
            <span className="ach-icon" aria-hidden="true">{row.icon ?? '🏅'}</span>
            <span className="ach-name">{t(row.name_ar, row.name_en ?? row.name_ar)}</span>
            {(row.times ?? 0) > 1 && <span className="ach-times eng">×{row.times}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
