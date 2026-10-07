import Link from 'next/link';

import { Avatar } from '../../shell/ProfileMenu';
import { levelInfo } from '@/lib/xp';
import { getT } from '@/lib/i18n.server';
import type { T, Text } from '@/lib/i18n';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

export type ActivityDay = { on_date: string; sources: string[] };

const WEEKDAY: Text[] = [
  { ar: 'أحد',   en: 'Sun' },
  { ar: 'إثنين', en: 'Mon' },
  { ar: 'ثلاثاء',en: 'Tue' },
  { ar: 'أربعاء',en: 'Wed' },
  { ar: 'خميس',  en: 'Thu' },
  { ar: 'جمعة',  en: 'Fri' },
  { ar: 'سبت',   en: 'Sat' },
];

const SOURCE_LABEL: Record<string, Text> = {
  lesson:         { ar: 'درس',            en: 'lesson' },
  work:           { ar: 'تسليم',          en: 'submission' },
  assessment:     { ar: 'اختبار',         en: 'assessment' },
  mentor_session: { ar: 'جلسة إرشاد',     en: 'mentor session' },
  team:           { ar: 'مهمة فريق',      en: 'team task' },
  course:         { ar: 'انضمام لمسار',   en: 'joined a path' },
};

/**
 * The top of the home page: who you are, and the three numbers a learner
 * checks first — the streak, the points, the stars — on one coloured card
 * (design lab: greeting and indicators merged with the large card). They sit
 * here rather than in the side column so a phone shows them before anything else.
 */
export async function StudentHero({
  name,
  avatarUrl,
  primaryField,
  currentPath,
  totalXp,
  stars,
  streak,
}: {
  name: string;
  avatarUrl: string | null;
  primaryField: string | null;
  currentPath: { slug: string; title: string; percent: number } | null;
  totalXp: number;
  stars: number;
  streak: number;
}) {
  const t: T = await getT();
  const level = levelInfo(totalXp);
  const hour = Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: PLATFORM_TIME_ZONE }).format(new Date()));
  const greeting = hour < 12 ? t('صباح الخير', 'Good morning') : t('مساء الخير', hour < 18 ? 'Good afternoon' : 'Good evening');
  const firstName = name.trim().split(/\s+/)[0];

  return (
    <>
      {/* The greeting and the day's numbers on one coloured card, the streak first
          and largest — the number a learner keeps coming back to protect. */}
      <section className="hm-hello hm-hero section-block">
        <div className="hm-hello-id">
          <Avatar name={name} url={avatarUrl} size={56} />
          <div style={{ minWidth: 0 }}>
            <h1>{greeting}{t('، ', ', ')}{firstName} 👋</h1>
            <p className="hm-hero-sub">
              {primaryField ?? t('لم تحدّد مجالك الرئيسي بعد', 'No primary field chosen yet')}
              {currentPath && <> · {currentPath.title}</>}
            </p>
          </div>
        </div>

        <div className="hm-hero-row">
          <p className="hm-hero-streak" title={t('أيام متتالية من الإنجاز', 'Days in a row with something finished')}>
            <span aria-hidden="true">🔥</span>
            <strong>{streak}</strong>
            <span>
              {streak > 0
                ? t(streak === 1 ? 'يوم إنجاز' : 'أيام متتالية', streak === 1 ? 'day in a row' : 'days in a row')
                : t('ابدأ حماستك اليوم', 'Start your streak today')}
            </span>
          </p>

          <div className="hm-pills">
            <span className="hm-pill is-xp" title={t('نقاط TechMood', 'TechMood points')}>
              <span aria-hidden="true">⚡</span>
              <strong>{totalXp}</strong>
              <span className="hm-pill-label">XP</span>
            </span>
            <span className="hm-pill is-stars" title={t('متوسط تقييم أعمالك', 'Average rating of your work')}>
              <span aria-hidden="true">⭐</span>
              <strong>{stars > 0 ? stars.toFixed(1) : '—'}</strong>
            </span>
            <span className="hm-pill is-level">{t(level.current.title)}</span>
          </div>
        </div>
      </section>

      {!primaryField && (
        <p className="notice section-block">
          {t('حدّد مجالك الرئيسي من ', 'Choose your primary field in ')}
          <Link href="/settings/fields">{t('مجالاتي', 'My fields')}</Link>
          {t(' — عليه تُبنى مطابقة المنتورز والفرق والفرص.',
             ' — mentor, team and opening matching are all built on it.')}
        </p>
      )}
    </>
  );
}

/**
 * The week, day by day. A day turns solid when something was finished on it —
 * a lesson, a submission, an assessment, an attended session, a closed team
 * task. Logging in is not work, and neither is a timer.
 */
export async function StreakCard({
  streak,
  week,
  totalXp,
}: {
  streak: number;
  week: ActivityDay[];
  totalXp: number;
}) {
  const t: T = await getT();
  const level = levelInfo(totalXp);
  const todayKey = week.length ? week[week.length - 1].on_date : '';
  const doneToday = week.some((day) => day.on_date === todayKey && day.sources.length > 0);

  return (
    <article className="hm-card hm-streak">
      <div className="hm-streak-head">
        <span className={`hm-flame${streak > 0 ? ' is-on' : ''}`} aria-hidden="true">🔥</span>
        <div>
          <strong className="hm-streak-num">
            {t(`${streak} ${streak === 1 ? 'يوم' : 'أيام'} متتالية`, `${streak}-day streak`)}
          </strong>
          <p className="muted">
            {doneToday
              ? t('أنجزت شيئاً اليوم — أحسنت.', 'You finished something today — nice.')
              : t('أنهِ درساً أو مهمة اليوم لتحافظ على التتابع.', 'Finish a lesson or a task today to keep it going.')}
          </p>
        </div>
      </div>

      <ol className="hm-week" aria-label={t('نشاط الأسبوع', 'This week’s activity')}>
        {week.map((day) => {
          const date = new Date(`${day.on_date}T00:00:00`);
          const active = day.sources.length > 0;
          const what = day.sources
            .map((source) => (SOURCE_LABEL[source] ? t(SOURCE_LABEL[source]) : source))
            .join(t('، ', ', '));
          return (
            <li className={`${active ? 'is-active' : ''}${day.on_date === todayKey ? ' is-today' : ''}`}
                key={day.on_date}
                title={active ? what : t('لا نشاط', 'nothing finished')}>
              <span className="hm-week-dot" aria-hidden="true">{active ? '✓' : ''}</span>
              <span className="hm-week-label">{t(WEEKDAY[date.getDay()])}</span>
              <span className="sr-only">{active ? what : t('لا نشاط', 'nothing finished')}</span>
            </li>
          );
        })}
      </ol>

      <div className="hm-level">
        <div className="row-between">
          <strong>{t(level.current.title)}</strong>
          {level.next && (
            <span className="muted">{t(`التالي: ${t(level.next.title)}`, `Next: ${t(level.next.title)}`)}</span>
          )}
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${level.percent}%` }} />
        </div>
        <p className="muted">
          {level.next
            ? t(`${level.next.minXp - totalXp} نقطة للرتبة التالية`, `${level.next.minXp - totalXp} XP to the next rank`)
            : t('وصلت أعلى رتبة.', 'You reached the top rank.')}
        </p>
      </div>
    </article>
  );
}
