'use client';

import { useMemo, useRef, useState } from 'react';

import { useT } from '@/lib/i18n.client';

export type ActivityPoint = { on_date: string; xp: number; lessons: number; acts: number };

const W = 600;
const H = 150;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

/** Intensity 0–4 from a day's work: what it did, and how much XP it earned. */
function level(day: ActivityPoint) {
  if (day.acts === 0 && day.xp === 0 && day.lessons === 0) return 0;
  const score = day.lessons + day.acts + day.xp / 15;
  return score >= 8 ? 4 : score >= 5 ? 3 : score >= 2 ? 2 : 1;
}

function shortDate(iso: string, locale: 'ar' | 'en') {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    day: 'numeric', month: 'short',
  });
}

/**
 * The home's two activity pictures (0128): a Duolingo-style grid of days,
 * darker the more was done, and a stock-style line of total XP over time.
 * Time runs left to right in both, as on any chart, whatever the page's
 * direction.
 */
export function ActivityCharts({ days, totalXp }: { days: ActivityPoint[]; totalXp: number }) {
  const t = useT();
  const [view, setView] = useState<'grid' | 'xp'>('grid');
  const [range, setRange] = useState<30 | 91>(91);

  const active = days.filter((day) => level(day) > 0).length;
  const lessons = days.reduce((sum, day) => sum + day.lessons, 0);

  return (
    <div className="ac-card">
      <div className="ac-head">
        <div className="ac-stats">
          <span><strong className="eng">{active}</strong> {t('يوم نشاط', 'active days')}</span>
          <span><strong className="eng">{lessons}</strong> {t('درساً', 'lessons')}</span>
          <span className="muted">{t('آخر 13 أسبوعاً', 'last 13 weeks')}</span>
        </div>
        <div className="ac-switch" role="tablist" aria-label={t('طريقة العرض', 'View')}>
          <button type="button" role="tab" aria-selected={view === 'grid'} className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')}>
            {t('الأيام', 'Days')}
          </button>
          <button type="button" role="tab" aria-selected={view === 'xp'} className={view === 'xp' ? 'is-on' : ''} onClick={() => setView('xp')}>
            {t('نقاط XP', 'XP')}
          </button>
        </div>
      </div>

      {view === 'grid'
        ? <DayGrid days={days} />
        : (
          <>
            <div className="ac-range">
              {([30, 91] as const).map((value) => (
                <button key={value} type="button" className={range === value ? 'is-on' : ''} onClick={() => setRange(value)}>
                  {value === 30 ? t('30 يوماً', '30 days') : t('3 أشهر', '3 months')}
                </button>
              ))}
            </div>
            <XpLine days={days.slice(-range)} totalXp={totalXp} />
          </>
        )}
    </div>
  );
}

function DayGrid({ days }: { days: ActivityPoint[] }) {
  const t = useT();
  const [hover, setHover] = useState<ActivityPoint | null>(null);

  // Columns are weeks; the first column is padded so each row is one weekday.
  const weeks = useMemo(() => {
    if (days.length === 0) return [] as (ActivityPoint | null)[][];
    const firstDow = new Date(`${days[0].on_date}T12:00:00`).getDay(); // 0 = Sunday
    const cells: (ActivityPoint | null)[] = [...Array(firstDow).fill(null), ...days];
    const out: (ActivityPoint | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [days]);

  const weekdayNames = t.locale === 'ar'
    ? ['أحد', '', 'ثلاثاء', '', 'خميس', '', 'سبت']
    : ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];

  return (
    <div className="ac-grid-wrap" dir="ltr">
      <div className="ac-grid" role="img"
           aria-label={t(`شبكة النشاط: ${days.filter((d) => level(d) > 0).length} يوم نشاط من ${days.length}`,
                         `Activity grid: ${days.filter((d) => level(d) > 0).length} active days of ${days.length}`)}>
        <div className="ac-weekdays" aria-hidden="true">
          {weekdayNames.map((name, index) => <span key={index}>{name}</span>)}
        </div>
        {weeks.map((week, index) => (
          <div className="ac-week" key={index}>
            {week.map((day, dayIndex) => day
              ? (
                <span
                  key={day.on_date}
                  className={`ac-cell l${level(day)}`}
                  onPointerEnter={() => setHover(day)}
                  onPointerLeave={() => setHover(null)}
                  title={`${shortDate(day.on_date, t.locale)} · ${day.xp} XP`}
                />
              )
              : <span key={`pad-${dayIndex}`} className="ac-cell is-pad" />)}
          </div>
        ))}
      </div>
      <div className="ac-foot">
        <span className="ac-tip" aria-live="polite">
          {hover
            ? <>{shortDate(hover.on_date, t.locale)} · <b>{hover.xp}</b> XP · {t(`${hover.lessons} درس`, `${hover.lessons} lessons`)}</>
            : t('مرّر على يوم لترى ما فعلته فيه', 'Hover a day to see what you did')}
        </span>
        <span className="ac-legend" aria-hidden="true">
          {t('أقل', 'Less')}
          {[0, 1, 2, 3, 4].map((lv) => <span key={lv} className={`ac-cell l${lv}`} />)}
          {t('أكثر', 'More')}
        </span>
      </div>
    </div>
  );
}

function XpLine({ days, totalXp }: { days: ActivityPoint[]; totalXp: number }) {
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Total XP at the end of each day, counted back from today's total.
  const series = useMemo(() => {
    const inWindow = days.reduce((sum, day) => sum + day.xp, 0);
    const start = Math.max(totalXp - inWindow, 0);
    return days.reduce<{ date: string; total: number; gained: number }[]>((out, day) => {
      const before = out.length ? out[out.length - 1].total : start;
      return [...out, { date: day.on_date, total: before + day.xp, gained: day.xp }];
    }, []);
  }, [days, totalXp]);

  if (series.length === 0) return null;

  const min = Math.min(...series.map((p) => p.total));
  const max = Math.max(...series.map((p) => p.total));
  const span = Math.max(max - min, 10);
  const lo = Math.max(min - span * 0.1, 0);
  const hi = max + span * 0.1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`;
  const gained = series[series.length - 1].total - (series[0].total - series[0].gained);
  const hover = hoverIndex !== null ? series[hoverIndex] : null;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const px = ratio * W;
    const index = Math.round(((px - PAD.left) / innerW) * (series.length - 1));
    setHoverIndex(Math.min(Math.max(index, 0), series.length - 1));
  }

  return (
    <div className="ac-line" dir="ltr">
      <div className="ac-line-head">
        <strong className="eng">{(hover?.total ?? series[series.length - 1].total).toLocaleString('en')} XP</strong>
        <span className={`ac-delta${gained > 0 ? ' is-up' : ''}`}>
          {hover
            ? `${shortDate(hover.date, t.locale)} · +${hover.gained}`
            : `${gained > 0 ? '▲' : '—'} +${gained} ${t('في الفترة', 'this period')}`}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="ac-svg"
        role="img"
        aria-label={t(`مجموع نقاطك ${series[series.length - 1].total}، بزيادة ${gained} في الفترة`,
                      `Your total is ${series[series.length - 1].total} XP, up ${gained} in this period`)}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH * f} y2={PAD.top + innerH * f} className="ac-gridline" />
        ))}
        <path d={area} className="ac-area" />
        <path d={line} className="ac-path" />
        {hover && hoverIndex !== null && (
          <>
            <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.top} y2={PAD.top + innerH} className="ac-cross" />
            <circle cx={x(hoverIndex)} cy={y(hover.total)} r={5} className="ac-dot" />
          </>
        )}
        <text x={PAD.left} y={H - 6} className="ac-axis">{shortDate(series[0].date, t.locale)}</text>
        <text x={W - PAD.right} y={H - 6} className="ac-axis" textAnchor="end">{t('اليوم', 'Today')}</text>
      </svg>
    </div>
  );
}
