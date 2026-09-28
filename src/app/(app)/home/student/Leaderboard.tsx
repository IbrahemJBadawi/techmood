'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Stars } from '@/components/Stars';
import { useT } from '@/lib/i18n.client';
import type { T, Text } from '@/lib/i18n';
import { IS_MVP } from '@/lib/scope';
import { avatarColor, initialOf } from '@/lib/mentor-look';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

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

type BoardTab = {
  key: keyof Boards; label: Text; extraLabel: Text; showStars: boolean; showPoints: boolean;
};

const TABS: BoardTab[] = ([
  { key: 'students',  label: { ar: 'الطلاب',   en: 'Students' },      extraLabel: { ar: 'إنجازات', en: 'Achievements' }, showStars: true,  showPoints: true },
  { key: 'mentors',   label: { ar: 'المنتورز', en: 'Mentors' },       extraLabel: { ar: 'جلسات',   en: 'Sessions' },     showStars: true,  showPoints: true },
  { key: 'teams',     label: { ar: 'الفرق',    en: 'Teams' },         extraLabel: { ar: 'مشاريع',  en: 'Projects' },     showStars: true,  showPoints: true },
  { key: 'companies', label: { ar: 'المؤسسات', en: 'Organisations' }, extraLabel: { ar: 'تعيينات',en: 'Hires' },        showStars: false, showPoints: false },
] as BoardTab[]).filter((entry) => !IS_MVP || entry.key !== 'companies');

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
    <article className="hm-card hm-league" id="leaderboard">
      <div className="hm-card-head">
        <h3>🏆 {t('الدوري', 'League')}</h3>
        {tab === 'students' && myRank !== null && (
          <span className="hm-myrank">{t('ترتيبك ', 'You are ')}<strong>#{myRank}</strong></span>
        )}
      </div>

      <div className="hm-seg" role="tablist" aria-label={t('من تُرتِّب', 'Who is ranked')}>
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={tab === entry.key ? 'is-on' : ''}
            onClick={() => setTab(entry.key)}
          >
            {t(entry.label)}
          </button>
        ))}
      </div>

      <div className="hm-windows">
        {WINDOWS.map((entry) => (
          <Link
            key={entry.key}
            className={windowKey === entry.key ? 'is-on' : ''}
            href={`/home?lb=${entry.key}#leaderboard`}
            scroll={false}
          >
            {t(entry.label)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="muted" style={{ padding: '10px 2px', fontSize: '0.85rem' }}>
          {t('لا بيانات في هذه النافذة بعد.', 'No data in this window yet.')}
        </p>
      ) : (
        <ol className="hm-ranks">
          {rows.map((row) => (
            <li key={row.id} className={row.rank <= 3 ? `is-top is-${row.rank}` : undefined}>
              <span className="hm-rank">{MEDAL[row.rank] ?? row.rank}</span>
              <span className="hm-rank-avatar" style={{ background: avatarColor(row.id) }} aria-hidden="true">
                {initialOf(row.name)}
              </span>
              <span className="hm-rank-name">
                <strong>{row.name}</strong>
                <span className="muted">
                  {row.extra} {t(active.extraLabel)}
                  {active.showStars && row.stars ? <> · <Stars value={row.stars} /></> : null}
                </span>
              </span>
              {active.showPoints && <span className="hm-rank-xp" dir="ltr">{row.points ?? 0} XP</span>}
            </li>
          ))}
        </ol>
      )}

      {tab === 'companies' && (
        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
          {t('المؤسسات تُرتَّب بما سجّلته المنصة فعلاً: الفرص المنشورة ومن جرى تعيينهم. لا يوجد تقييم للمؤسسات بعد، لأن لا شيء في TechMood يقيّم جهة عمل حتى الآن.',
             'Organisations are ranked on what the platform actually recorded: the openings they published and the people they took on. There is no rating for an organisation yet, because nothing on TechMood rates an employer so far.')}
        </p>
      )}
    </article>
  );
}
