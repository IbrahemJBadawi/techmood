import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { Avatar } from '../../shell/ProfileMenu';
import { levelInfo } from '@/lib/xp';

export type ActivityDay = { on_date: string; sources: string[] };

const WEEKDAY = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const SOURCE_LABEL: Record<string, string> = {
  lesson: 'درس',
  work: 'تسليم',
  assessment: 'اختبار',
  mentor_session: 'جلسة إرشاد',
  team: 'مهمة فريق',
  course: 'انضمام لمسار',
};

/**
 * The strip is filled by what happened, not by opening the app. A day turns
 * solid when something was finished on it — a lesson, a submission, an
 * assessment, an attended session, a closed team task. Logging in is not work,
 * and neither is a timer.
 */
export function StudentHero({
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
  const level = levelInfo(totalXp);

  return (
    <section className="panel section-block student-hero">
      <div className="student-hero-main">
        <Avatar name={name} url={avatarUrl} size={64} />

        <div className="student-hero-id">
          <p className="kicker">أهلاً بعودتك</p>
          <h2>{name}</h2>
          <p className="muted">
            {primaryField ?? 'لم تحدّد مجالك الرئيسي بعد'}
            {currentPath && <> · {currentPath.title}</>}
          </p>
          <div className="tags-row" style={{ marginTop: 8 }}>
            <span className="badge-pill">{level.current.title}</span>
            <span className="id-chip">{techmoodId}</span>
          </div>
        </div>

        <div className="student-hero-meters">
          <div className="meter">
            <span className="meter-label">التقييم</span>
            <Stars value={stars} />
            <span className="meter-note">{ratedCount} عمل مُقيَّم</span>
          </div>
          <div className="meter">
            <span className="meter-label">نقاط TechMood</span>
            <span className="xp-badge eng">{totalXp} XP</span>
            <span className="meter-note">كمّية ما أنجزت</span>
          </div>
          <div className="meter">
            <span className="meter-label">التتابع</span>
            <span className="streak-badge">🔥 {streak}</span>
            <span className="meter-note">{streak === 1 ? 'يوم' : 'أيام'} متتالية</span>
          </div>
        </div>
      </div>

      {level.next && (
        <div className="student-hero-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${level.percent}%` }} />
          </div>
          <p className="muted">{level.percent}% نحو رتبة «{level.next.title}»</p>
        </div>
      )}

      <div className="week-strip" aria-label="نشاط الأسبوع">
        {week.map((day) => {
          const date = new Date(`${day.on_date}T00:00:00`);
          const active = day.sources.length > 0;
          const what = day.sources.map((source) => SOURCE_LABEL[source] ?? source).join('، ');
          return (
            <div className={`week-day${active ? ' is-active' : ''}`} key={day.on_date}>
              <span className="week-dot" title={active ? what : 'لا نشاط'} aria-hidden="true" />
              <span className="week-label">{WEEKDAY[date.getDay()]}</span>
              <span className="sr-only">
                {active ? `${WEEKDAY[date.getDay()]}: ${what}` : `${WEEKDAY[date.getDay()]}: لا نشاط`}
              </span>
            </div>
          );
        })}
      </div>

      {!primaryField && (
        <p className="notice">
          حدّد مجالك الرئيسي من <Link href="/settings/fields">مجالاتي</Link> — عليه
          تُبنى مطابقة المنتورز والفرق والفرص.
        </p>
      )}
    </section>
  );
}
