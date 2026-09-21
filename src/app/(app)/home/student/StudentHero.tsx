import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { Avatar } from '../../shell/ProfileMenu';
import { levelInfo } from '@/lib/xp';
import { getT } from '@/lib/i18n.server';
import type { T, Text } from '@/lib/i18n';

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
 * The strip is filled by what happened, not by opening the app. A day turns
 * solid when something was finished on it — a lesson, a submission, an
 * assessment, an attended session, a closed team task. Logging in is not work,
 * and neither is a timer.
 */
export async function StudentHero({
  name,
  avatarUrl,
  techmoodId,
  primaryField,
  currentPath,
  totalXp,
  stars,
  ratedCount,
  streak,
  week,
}: {
  name: string;
  avatarUrl: string | null;
  techmoodId: string;
  primaryField: string | null;
  currentPath: { slug: string; title: string; percent: number } | null;
  totalXp: number;
  stars: number;
  ratedCount: number;
  streak: number;
  week: ActivityDay[];
}) {
  const t: T = await getT();
  const level = levelInfo(totalXp);

  return (
    <section className="panel section-block student-hero">
      <div className="student-hero-main">
        <Avatar name={name} url={avatarUrl} size={64} />

        <div className="student-hero-id">
          <p className="kicker">{t('أهلاً بعودتك', 'Welcome back')}</p>
          <h2>{name}</h2>
          <p className="muted">
            {primaryField ?? t('لم تحدّد مجالك الرئيسي بعد', 'No primary field chosen yet')}
            {currentPath && <> · {currentPath.title}</>}
          </p>
          <div className="tags-row" style={{ marginTop: 8 }}>
            <span className="badge-pill">{t(level.current.title)}</span>
            <span className="id-chip">{techmoodId}</span>
          </div>
        </div>

        <div className="student-hero-meters">
          <div className="meter">
            <span className="meter-label">{t('التقييم', 'Rating')}</span>
            <Stars value={stars} />
            <span className="meter-note">
              {t(`${ratedCount} عمل مُقيَّم`, `${ratedCount} rated ${ratedCount === 1 ? 'piece' : 'pieces'}`)}
            </span>
          </div>
          <div className="meter">
            <span className="meter-label">{t('نقاط TechMood', 'TechMood points')}</span>
            <span className="xp-badge eng">{totalXp} XP</span>
            <span className="meter-note">{t('كمّية ما أنجزت', 'how much you have done')}</span>
          </div>
          <div className="meter">
            <span className="meter-label">{t('التتابع', 'Streak')}</span>
            <span className="streak-badge">🔥 {streak}</span>
            <span className="meter-note">
              {t(streak === 1 ? 'يوم متتالٍ' : 'أيام متتالية',
                 streak === 1 ? 'day in a row' : 'days in a row')}
            </span>
          </div>
        </div>
      </div>

      {level.next && (
        <div className="student-hero-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${level.percent}%` }} />
          </div>
          <p className="muted">
            {t(`${level.percent}% نحو رتبة «${t(level.next.title)}»`,
               `${level.percent}% towards “${t(level.next.title)}”`)}
          </p>
        </div>
      )}

      <div className="week-strip" aria-label={t('نشاط الأسبوع', 'This week’s activity')}>
        {week.map((day) => {
          const date = new Date(`${day.on_date}T00:00:00`);
          const active = day.sources.length > 0;
          const what = day.sources
            .map((source) => (SOURCE_LABEL[source] ? t(SOURCE_LABEL[source]) : source))
            .join(t('، ', ', '));
          return (
            <div className={`week-day${active ? ' is-active' : ''}`} key={day.on_date}>
              <span className="week-dot"
                    title={active ? what : t('لا نشاط', 'nothing finished')}
                    aria-hidden="true" />
              <span className="week-label">{t(WEEKDAY[date.getDay()])}</span>
              <span className="sr-only">
                {active
                  ? `${t(WEEKDAY[date.getDay()])}: ${what}`
                  : `${t(WEEKDAY[date.getDay()])}: ${t('لا نشاط', 'nothing finished')}`}
              </span>
            </div>
          );
        })}
      </div>

      {!primaryField && (
        <p className="notice">
          {t('حدّد مجالك الرئيسي من ', 'Choose your primary field in ')}
          <Link href="/settings/fields">{t('مجالاتي', 'My fields')}</Link>
          {t(' — عليه تُبنى مطابقة المنتورز والفرق والفرص.',
             ' — mentor, team and opening matching are all built on it.')}
        </p>
      )}
    </section>
  );
}
