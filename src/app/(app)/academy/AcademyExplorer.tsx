'use client';

import { useEffect, useMemo, useState } from 'react';

import type { CourseLevel, LearningStatus } from '@/lib/database.types';
import { useT } from '@/lib/i18n.client';

import { CourseCard } from './CourseCard';
import { PathCard } from './PathCard';
import {
  courseCount, courseHaystack, LEVEL_LABEL, LEVEL_ORDER, pathCount, pathHaystack,
  resultCount, STATUS_LABEL, type AcademyCourse, type AcademyPath,
} from './types';

type Tab = 'all' | 'paths' | 'courses';
const PAGE = 6;

/**
 * Discovery: one search box, the schools as categories, and the filters that
 * narrow both lists at once.
 *
 * The whole catalogue arrives once, already carrying this learner's standing,
 * and the filtering happens here — so a keystroke costs nothing and the page
 * never round-trips for a chip. The sections that belong to the learner are
 * passed in as children and sit between the search and the results; the moment
 * a search or a filter is on they step aside, so the same card is never shown
 * twice on one screen.
 */
export function AcademyExplorer({
  paths,
  courses,
  children,
}: {
  paths: AcademyPath[];
  courses: AcademyCourse[];
  children: React.ReactNode;
}) {
  const t = useT();

  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [domain, setDomain] = useState<string | null>(null);
  const [level, setLevel] = useState<CourseLevel | ''>('');
  const [status, setStatus] = useState<LearningStatus | ''>('');
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // A keystroke should not cost a re-filter of the whole catalogue.
  useEffect(() => {
    const id = setTimeout(() => setQuery(typed.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [typed]);

  // The filters are a drawer on a phone and an open row on a wide screen. The
  // server renders it closed, so the markup matches on hydration either way.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 761px)');
    const apply = () => setFiltersOpen(wide.matches);
    apply();
    wide.addEventListener('change', apply);
    return () => wide.removeEventListener('change', apply);
  }, []);

  // Changing what is being looked for starts the list again from the top. This
  // is the adjust-during-render pattern rather than an effect: the first page
  // is a function of the filters, not a reaction to them.
  const filterKey = `${query}|${tab}|${domain ?? ''}|${level}|${status}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setShown(PAGE);
  }

  // The categories are the schools the catalogue actually has, counted from it.
  const categories = useMemo(() => {
    const map = new Map<string, { slug: string; ar: string; en: string | null; count: number }>();
    for (const path of paths) {
      if (!path.school_slug) continue;
      const found = map.get(path.school_slug);
      if (found) found.count += 1;
      else map.set(path.school_slug, {
        slug: path.school_slug,
        ar: path.school_name_ar ?? path.school_slug,
        en: path.school_name_en,
        count: 1,
      });
    }
    return [...map.values()];
  }, [paths]);

  const haystacks = useMemo(() => ({
    paths: new Map(paths.map((p) => [p.id, pathHaystack(p)])),
    courses: new Map(courses.map((c) => [c.id, courseHaystack(c)])),
  }), [paths, courses]);

  const matchedPaths = useMemo(() => paths.filter((path) => {
    if (query && !(haystacks.paths.get(path.id) ?? '').includes(query)) return false;
    if (domain && path.school_slug !== domain) return false;
    if (status && path.status !== status) return false;
    // A path covers a range, so it matches a level it reaches.
    if (level && !(path.level_from && path.level_to
      && LEVEL_ORDER.indexOf(path.level_from) <= LEVEL_ORDER.indexOf(level)
      && LEVEL_ORDER.indexOf(path.level_to) >= LEVEL_ORDER.indexOf(level))) return false;
    return true;
  }), [paths, haystacks, query, domain, status, level]);

  const matchedCourses = useMemo(() => courses.filter((course) => {
    if (query && !(haystacks.courses.get(course.id) ?? '').includes(query)) return false;
    if (domain && !course.school_slugs.includes(domain)) return false;
    if (status && course.status !== status) return false;
    if (level && course.level !== level) return false;
    return true;
  }), [courses, haystacks, query, domain, status, level]);

  const narrowed = query !== '' || domain !== null || level !== '' || status !== '';
  const showPaths = tab !== 'courses';
  const showCourses = tab !== 'paths';
  const total = (showPaths ? matchedPaths.length : 0) + (showCourses ? matchedCourses.length : 0);

  const clear = () => {
    setTyped(''); setQuery(''); setDomain(null); setLevel(''); setStatus(''); setTab('all');
  };

  return (
    <>
      {/* ---- search ---- */}
      <section className="section-block" aria-labelledby="academy-search-label">
        <form className="academy-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="academy-search" id="academy-search-label">
            {t('ابحث في الأكاديمية', 'Search the academy')}
          </label>
          <input
            id="academy-search"
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={t('اسم مسار، دورة، أو مهارة…', 'A path, a course, or a skill…')}
            autoComplete="off"
          />
        </form>
      </section>

      {/* ---- categories ---- */}
      {categories.length > 0 && (
        <section className="section-block" aria-labelledby="academy-categories">
          <h2 id="academy-categories" className="academy-heading">
            {t('مجالات التعلّم', 'Learning categories')}
          </h2>
          <div className="explore-row" role="group" aria-label={t('مجالات التعلّم', 'Learning categories')}>
            <button
              type="button"
              className={`explore-chip ${domain === null ? 'is-on' : ''}`}
              aria-pressed={domain === null}
              onClick={() => setDomain(null)}
            >
              {t('الكل', 'All')}
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category.slug}
                className={`explore-chip ${domain === category.slug ? 'is-on' : ''}`}
                aria-pressed={domain === category.slug}
                onClick={() => setDomain(domain === category.slug ? null : category.slug)}
              >
                {t.locale === 'ar' ? category.ar : (category.en ?? category.ar)}
                <span className="muted eng"> {category.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* The learner's own sections — set aside while a search is on. */}
      {!narrowed && children}

      {/* ---- results ---- */}
      <section className="section-block" aria-labelledby="academy-explore">
        <div className="row-between academy-explore-head">
          <h2 id="academy-explore" className="academy-heading">
            {narrowed ? t('نتائج البحث', 'Search results') : t('استكشف كل التعلّم', 'Explore all learning')}
          </h2>
          {narrowed && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
              {t('مسح الفلاتر', 'Clear filters')}
            </button>
          )}
        </div>

        <div className="tabs" role="tablist" aria-label={t('نوع المحتوى', 'Content type')}>
          {([
            ['all', t('الكل', 'All')],
            ['paths', t('المسارات', 'Paths')],
            ['courses', t('الدورات', 'Courses')],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`tab ${tab === key ? 'is-on' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <details className="academy-filters" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
          <summary>{t('الفلاتر', 'Filters')}</summary>
          <div className="academy-filter-row">
            <div className="field">
              <label htmlFor="academy-level">{t('المستوى', 'Level')}</label>
              <select
                id="academy-level"
                value={level}
                onChange={(event) => setLevel(event.target.value as CourseLevel | '')}
              >
                <option value="">{t('كل المستويات', 'All levels')}</option>
                {LEVEL_ORDER.map((key) => (
                  <option value={key} key={key}>{LEVEL_LABEL[key][t.locale]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="academy-status">{t('الحالة', 'Status')}</label>
              <select
                id="academy-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as LearningStatus | '')}
              >
                <option value="">{t('كل الحالات', 'Any status')}</option>
                {(['not_started', 'in_progress', 'completed'] as LearningStatus[]).map((key) => (
                  <option value={key} key={key}>{STATUS_LABEL[key][t.locale]}</option>
                ))}
              </select>
            </div>
          </div>
        </details>

        <p className="muted academy-count" aria-live="polite">
          {resultCount(t.locale, total)}
          {showPaths && showCourses && total > 0 && (
            <> — {pathCount(t.locale, matchedPaths.length)}، {courseCount(t.locale, matchedCourses.length)}</>
          )}
        </p>

        {total === 0 ? (
          <div className="panel empty-state">
            <h3 style={{ fontSize: '0.98rem' }}>{t('لا نتائج', 'Nothing matched')}</h3>
            <p className="muted" style={{ fontSize: '0.88rem' }}>
              {t('لا يوجد في الكتالوج ما يطابق هذا البحث. جرّب كلمة أعمّ أو امسح الفلاتر.',
                 'Nothing in the catalogue matches that. Try a broader word, or clear the filters.')}
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={clear}>
              {t('مسح الفلاتر', 'Clear filters')}
            </button>
          </div>
        ) : (
          <>
            {showPaths && matchedPaths.length > 0 && (
              <div className="card-grid">
                {matchedPaths.slice(0, shown).map((path) => <PathCard path={path} key={path.id} />)}
              </div>
            )}
            {showCourses && matchedCourses.length > 0 && (
              <div className="card-grid" style={{ marginTop: showPaths && matchedPaths.length > 0 ? 16 : 0 }}>
                {matchedCourses.slice(0, shown).map((course) => <CourseCard course={course} key={course.id} />)}
              </div>
            )}
            {(matchedPaths.length > shown || matchedCourses.length > shown) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm academy-more"
                onClick={() => setShown((value) => value + PAGE)}
              >
                {t('عرض المزيد', 'Show more')}
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
