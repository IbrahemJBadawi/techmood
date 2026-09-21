'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Stars } from '@/components/Stars';
import { useT } from '@/lib/i18n.client';
import type { T, Text } from '@/lib/i18n';

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

const TABS: {
  key: keyof Boards; label: Text; extraLabel: Text; showStars: boolean; showPoints: boolean;
}[] = [
  { key: 'students',  label: { ar: 'الطلاب',   en: 'Students' },      extraLabel: { ar: 'إنجازات', en: 'Achievements' }, showStars: true,  showPoints: true },
  { key: 'mentors',   label: { ar: 'المنتورز', en: 'Mentors' },       extraLabel: { ar: 'جلسات',   en: 'Sessions' },     showStars: true,  showPoints: true },
  { key: 'teams',     label: { ar: 'الفرق',    en: 'Teams' },         extraLabel: { ar: 'مشاريع',  en: 'Projects' },     showStars: true,  showPoints: true },
  { key: 'companies', label: { ar: 'المؤسسات', en: 'Organisations' }, extraLabel: { ar: 'تعيينات',en: 'Hires' },        showStars: false, showPoints: false },
];

const WINDOWS: { key: 'month' | 'year' | 'all'; label: Text }[] = [
  { key: 'month', label: { ar: 'هذا الشهر', en: 'This month' } },
  { key: 'year',  label: { ar: 'هذه السنة', en: 'This year' } },
  { key: 'all',   label: { ar: 'كل الوقت',  en: 'All time' } },
];

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
  const t: T = useT();
  const [tab, setTab] = useState<keyof Boards>('students');
  const active = TABS.find((entry) => entry.key === tab)!;
  const rows = boards[tab];

  return (
    <section className="section-block" id="leaderboard">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: '1.05rem' }}>{t('جدول الترتيب', 'Leaderboard')}</h2>
        <div className="tags-row">
          {WINDOWS.map((entry) => (
            <Link
              key={entry.key}
              className={`tag${windowKey === entry.key ? ' is-on' : ''}`}
              href={`/home?lb=${entry.key}#leaderboard`}
              scroll={false}
            >
              {t(entry.label)}
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
              {t(entry.label)}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="muted" style={{ padding: '14px 2px' }}>{t('لا بيانات في هذه النافذة بعد.', 'No data in this window yet.')}</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 52 }}>#</th>
                <th>{t('الاسم', 'Name')}</th>
                {active.showStars && <th>{t('التقييم', 'Rating')}</th>}
                {active.showPoints && <th>{t('النقاط', 'Points')}</th>}
                <th>{t(active.extraLabel)}</th>
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
            {t('المؤسسات تُرتَّب بما سجّلته المنصة فعلاً: الفرص المنشورة ومن جرى تعيينهم. لا يوجد تقييم للمؤسسات بعد، لأن لا شيء في TechMood يقيّم جهة عمل حتى الآن.',
               'Organisations are ranked on what the platform actually recorded: the openings they published and the people they took on. There is no rating for an organisation yet, because nothing on TechMood rates an employer so far.')}
          </p>
        )}

        {tab === 'students' && myRank !== null && (
          <p className="my-rank">
            {t('ترتيبك: ', 'Your rank: ')}<strong className="eng">#{myRank}</strong>
          </p>
        )}
      </div>
    </section>
  );
}
