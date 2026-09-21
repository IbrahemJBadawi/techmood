'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Stars } from '@/components/Stars';
import { useT } from '@/lib/i18n.client';
import type { ProjectKind } from '@/lib/database.types';

import { builderName, entryHaystack, KIND_LABEL, type GalleryEntry } from './types';

type Who = 'all' | 'students' | 'teams';
type Sort = 'recent' | 'rating';
const PAGE = 9;

/**
 * The gallery, searchable.
 *
 * Everything on screen comes from the frozen snapshots the server already
 * sent, so a keystroke costs nothing and no filter reaches into a private
 * workspace. The filters are the ones the entries can actually answer —
 * builder, kind, technology, path, rating — and nothing is offered that the
 * data cannot back.
 */
export function ExhibitionExplorer({ entries }: { entries: GalleryEntry[] }) {
  const t = useT();

  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [who, setWho] = useState<Who>('all');
  const [kind, setKind] = useState<ProjectKind | ''>('');
  const [tech, setTech] = useState('');
  const [path, setPath] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<Sort>('recent');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    const id = setTimeout(() => setQuery(typed.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [typed]);

  const filterKey = `${query}|${who}|${kind}|${tech}|${path}|${minRating}|${sort}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setShown(PAGE);
  }

  const haystacks = useMemo(
    () => new Map(entries.map((entry) => [entry.entry_code, entryHaystack(entry)])),
    [entries],
  );

  // The filter options are read off what is actually exhibited, so the gallery
  // can never offer a technology no project uses.
  const { technologies, paths } = useMemo(() => {
    const techSet = new Set<string>();
    const pathMap = new Map<string, string>();
    for (const entry of entries) {
      for (const item of entry.snapshot.technologies ?? []) techSet.add(item);
      if (entry.snapshot.path) pathMap.set(entry.snapshot.path.slug, entry.snapshot.path.title);
    }
    return {
      technologies: [...techSet].sort(),
      paths: [...pathMap.entries()].sort((a, b) => a[1].localeCompare(b[1])),
    };
  }, [entries]);

  const matched = useMemo(() => {
    const rows = entries.filter((entry) => {
      const snapshot = entry.snapshot;
      if (query && !(haystacks.get(entry.entry_code) ?? '').includes(query)) return false;
      if (who === 'teams' && !snapshot.team) return false;
      if (who === 'students' && snapshot.team) return false;
      if (kind && snapshot.kind !== kind) return false;
      if (tech && !(snapshot.technologies ?? []).includes(tech)) return false;
      if (path && snapshot.path?.slug !== path) return false;
      if (minRating > 0 && (snapshot.evaluation?.rating ?? 0) < minRating) return false;
      return true;
    });

    return sort === 'rating'
      ? [...rows].sort((a, b) => (b.snapshot.evaluation?.rating ?? 0) - (a.snapshot.evaluation?.rating ?? 0))
      : rows;
  }, [entries, haystacks, query, who, kind, tech, path, minRating, sort]);

  const clear = () => {
    setTyped(''); setQuery(''); setWho('all'); setKind(''); setTech(''); setPath('');
    setMinRating(0); setSort('recent');
  };

  const narrowed = query !== '' || who !== 'all' || kind !== '' || tech !== '' || path !== '' || minRating > 0;

  return (
    <>
      <form className="academy-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="exhibition-search">{t('ابحث في المعرض', 'Search the exhibition')}</label>
        <input
          id="exhibition-search"
          type="search"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t('مشروع، تقنية، مسار، أو اسم من بناه…', 'A project, a technology, a path, or who built it…')}
          autoComplete="off"
        />
      </form>

      <div className="explore-row" role="group" aria-label={t('من بناه', 'Who built it')} style={{ marginTop: 16 }}>
        {([
          ['all', t('الكل', 'All')],
          ['students', t('أفراد', 'Students')],
          ['teams', t('فرق', 'Teams')],
        ] as [Who, string][]).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={`explore-chip ${who === key ? 'is-on' : ''}`}
            aria-pressed={who === key}
            onClick={() => setWho(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <details className="academy-filters" open>
        <summary>{t('الفلاتر', 'Filters')}</summary>
        <div className="academy-filter-row">
          <div className="field">
            <label htmlFor="exhibit-kind">{t('نوع المشروع', 'Project type')}</label>
            <select id="exhibit-kind" value={kind} onChange={(event) => setKind(event.target.value as ProjectKind | '')}>
              <option value="">{t('كل الأنواع', 'Any type')}</option>
              {(Object.keys(KIND_LABEL) as ProjectKind[]).map((key) => (
                <option value={key} key={key}>{KIND_LABEL[key][t.locale]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="exhibit-tech">{t('التقنية', 'Technology')}</label>
            <select id="exhibit-tech" value={tech} onChange={(event) => setTech(event.target.value)}>
              <option value="">{t('كل التقنيات', 'Any technology')}</option>
              {technologies.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="exhibit-path">{t('المسار', 'Learning path')}</label>
            <select id="exhibit-path" value={path} onChange={(event) => setPath(event.target.value)}>
              <option value="">{t('كل المسارات', 'Any path')}</option>
              {paths.map(([slug, title]) => <option value={slug} key={slug}>{title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="exhibit-rating">{t('التقييم', 'Rating')}</label>
            <select id="exhibit-rating" value={minRating} onChange={(event) => setMinRating(Number(event.target.value))}>
              <option value={0}>{t('أي تقييم', 'Any rating')}</option>
              <option value={4}>{t('٤ فأعلى', '4 and up')}</option>
              <option value={4.5}>{t('٤٫٥ فأعلى', '4.5 and up')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="exhibit-sort">{t('الترتيب', 'Sort')}</label>
            <select id="exhibit-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="recent">{t('الأحدث', 'Recently added')}</option>
              <option value="rating">{t('الأعلى تقييماً', 'Highest rated')}</option>
            </select>
          </div>
        </div>
      </details>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <p className="muted academy-count" aria-live="polite" style={{ margin: 0 }}>
          {t(`${matched.length} مشروعاً`, `${matched.length} projects`)}
        </p>
        {narrowed && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
            {t('مسح الفلاتر', 'Clear filters')}
          </button>
        )}
      </div>

      {matched.length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا نتائج', 'Nothing matched')}</h3>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            {t('لا مشروع معروض يطابق هذا البحث.', 'No exhibited project matches that.')}
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={clear}>
            {t('مسح الفلاتر', 'Clear filters')}
          </button>
        </div>
      ) : (
        <>
          <div className="card-grid">
            {matched.slice(0, shown).map((entry) => {
              const snapshot = entry.snapshot;
              return (
                <article className="card exhibit-card" key={entry.entry_code}>
                  <div className="row-between academy-card-head">
                    <span className="kicker">{KIND_LABEL[snapshot.kind]?.[t.locale] ?? snapshot.kind}</span>
                    <span className="id-chip">{snapshot.project_code}</span>
                  </div>

                  <h3>{snapshot.project_title}</h3>
                  <p className="exhibit-builder">
                    {builderName(entry, t.locale)}
                    {snapshot.team && (snapshot.members?.length ?? 0) > 0 && (
                      <span className="muted"> · {t(`${snapshot.members.length} أعضاء`, `${snapshot.members.length} members`)}</span>
                    )}
                  </p>
                  <p>{snapshot.summary}</p>

                  <div className="tags-row">
                    {(snapshot.technologies ?? []).slice(0, 4).map((item) => (
                      <span className="tag eng" key={item}>{item}</span>
                    ))}
                  </div>

                  {snapshot.evaluation?.rating != null && (
                    <p className="exhibit-rating">
                      <Stars value={snapshot.evaluation.rating} />
                      <span className="eng">{snapshot.evaluation.rating.toFixed(1)} / 5</span>
                    </p>
                  )}

                  <ul className="exhibit-badges">
                    {snapshot.evaluation && <li>{t('✓ قُيِّم من منتور', '✓ Mentor evaluated')}</li>}
                    <li>{t('✓ موثّق من TechMood', '✓ TechMood verified')}</li>
                  </ul>

                  <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>
                    {t('عرض المشروع', 'View project')}
                  </Link>
                </article>
              );
            })}
          </div>

          {matched.length > shown && (
            <button type="button" className="btn btn-ghost btn-sm academy-more" onClick={() => setShown((value) => value + PAGE)}>
              {t('عرض المزيد', 'Show more')}
            </button>
          )}
        </>
      )}
    </>
  );
}
