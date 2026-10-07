'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { suggestAction } from '@/app/(app)/search/actions';
import { useT } from '@/lib/i18n.client';
import type { SearchGroup } from '@/lib/search';

/**
 * The search box, with suggestions under it while typing (design lab:
 * «مع اقتراحات أثناء الكتابة»). Enter, or «كل النتائج», opens the full /search
 * page; the arrow keys walk the suggestions, as in a combobox.
 */
export function SearchBox({
  initial = '', autoFocus = false, variant = 'page',
}: {
  initial?: string;
  autoFocus?: boolean;
  variant?: 'page' | 'header';
}) {
  const t = useT();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initial);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pending, startTransition] = useTransition();
  const asked = useRef('');
  const box = useRef<HTMLFormElement>(null);

  const term = query.trim();
  const rows = groups.flatMap((group) => group.rows.map((row) => ({ ...row, group: group.title })));

  // Ask a moment after typing stops, and drop answers to an older question.
  useEffect(() => {
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      asked.current = term;
      startTransition(async () => {
        const answer = await suggestAction(term);
        if (asked.current === term) { setGroups(answer); setActive(-1); }
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const go = (href: string) => { setOpen(false); router.push(href); };
  const showList = open && term.length >= 2;

  return (
    <form
      ref={box}
      className={variant === 'header' ? 'header-search search-box' : 'search-box search-box-page'}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (active >= 0 && rows[active]) return go(rows[active].href);
        if (term.length > 0) go(`/search?q=${encodeURIComponent(term)}`);
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.1" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={query}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (event.target.value.trim().length < 2) setGroups([]);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, rows.length - 1)); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
          if (event.key === 'Escape') setOpen(false);
        }}
        placeholder={t('ابحث عن زملاء، منتورز، دورات، فرق…', 'Search people, mentors, courses, teams…')}
        aria-label={t('بحث', 'Search')}
        enterKeyHint="search"
      />
      {pending && <span className="search-spin" aria-hidden="true" />}

      {showList && (
        <div className="search-suggest" id={listId} role="listbox" aria-label={t('اقتراحات', 'Suggestions')}>
          {rows.length === 0 && !pending && (
            <p className="search-suggest-empty">{t('لا اقتراحات — اضغط بحث لكل النتائج.', 'No suggestions — press search for everything.')}</p>
          )}
          {groups.map((group) => (
            <div key={group.kind} role="group" aria-label={group.title}>
              <div className="search-suggest-head">{group.title}</div>
              {group.rows.map((row) => {
                const index = rows.findIndex((item) => item.key === row.key && item.href === row.href);
                return (
                  <Link
                    key={`${group.kind}-${row.key}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={`search-suggest-row${index === active ? ' is-active' : ''}`}
                    href={row.href}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(index)}
                  >
                    <strong>{row.title}</strong>
                    {row.detail && <span>{row.detail}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          <Link className="search-suggest-all" href={`/search?q=${encodeURIComponent(term)}`} onClick={() => setOpen(false)}>
            {t(`كل النتائج عن «${term}»`, `All results for “${term}”`)}
          </Link>
        </div>
      )}
    </form>
  );
}
