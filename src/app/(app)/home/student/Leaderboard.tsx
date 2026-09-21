'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Stars } from '@/components/Stars';

export type BoardRow = {
  rank: number;
  id: string;
  name: string;
  avatarUrl: string | null;
  points: number | null;
  stars: number | null;
  extra: number;
};

export type Boards = Record<'students' | 'mentors' | 'teams' | 'companies', BoardRow[]>;

const TABS: { key: keyof Boards; label: string; extraLabel: string; showStars: boolean; showPoints: boolean }[] = [
  { key: 'students', label: 'الطلاب', extraLabel: 'إنجازات', showStars: true, showPoints: true },
  { key: 'mentors', label: 'المنتورز', extraLabel: 'جلسات', showStars: true, showPoints: true },
  { key: 'teams', label: 'الفرق', extraLabel: 'مشاريع', showStars: true, showPoints: true },
  { key: 'companies', label: 'المؤسسات', extraLabel: 'تعيينات', showStars: false, showPoints: false },
];

const WINDOWS = [
  { key: 'month', label: 'هذا الشهر' },
  { key: 'year', label: 'هذه السنة' },
  { key: 'all', label: 'كل الوقت' },
] as const;

export type WindowKey = (typeof WINDOWS)[number]['key'];

/**
 * Standing is XP for quantity and stars for quality, never one number that
 * quietly mixes them, and never a count of followers or logins.
 */
export function Leaderboard({
  boards,
  myRank,
  windowKey,
}: {
  boards: Boards;
  myRank: number | null;
  windowKey: WindowKey;
}) {
  const [tab, setTab] = useState<keyof Boards>('students');
  const active = TABS.find((entry) => entry.key === tab)!;
  const rows = boards[tab];

  return (
    <section className="section-block" id="leaderboard">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: '1.05rem' }}>جدول الترتيب</h2>
        <div className="tags-row">
          {WINDOWS.map((entry) => (
            <Link
              key={entry.key}
              className={`tag${windowKey === entry.key ? ' is-on' : ''}`}
              href={`/home?lb=${entry.key}#leaderboard`}
              scroll={false}
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="tabs" role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              className={`tab${tab === entry.key ? ' is-on' : ''}`}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="muted" style={{ padding: '14px 2px' }}>لا بيانات في هذه النافذة بعد.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 52 }}>#</th>
                <th>الاسم</th>
                {active.showStars && <th>التقييم</th>}
                {active.showPoints && <th>النقاط</th>}
                <th>{active.extraLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="eng">{row.rank}</td>
                  <td>{row.name}</td>
                  {active.showStars && (
                    <td>
                      {row.stars === null || row.stars === 0
                        ? <span className="muted">—</span>
                        : <Stars value={row.stars} />}
                    </td>
                  )}
                  {active.showPoints && <td className="eng">{row.points ?? 0}</td>}
                  <td className="eng">{row.extra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'companies' && (
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
            المؤسسات تُرتَّب بما سجّلته المنصة فعلاً: الفرص المنشورة ومن جرى
            تعيينهم. لا يوجد تقييم للمؤسسات بعد، لأن لا شيء في TechMood يقيّم
            جهة عمل حتى الآن.
          </p>
        )}

        {tab === 'students' && myRank !== null && (
          <p className="my-rank">ترتيبك: <strong className="eng">#{myRank}</strong></p>
        )}
      </div>
    </section>
  );
}
