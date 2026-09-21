'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useT } from '@/lib/i18n.client';

export function HeaderSearch({ initial = '' }: { initial?: string }) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState(initial);

  return (
    <form
      className="header-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const term = query.trim();
        if (term.length > 0) router.push(`/search?q=${encodeURIComponent(term)}`);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('ابحث في المسارات، المنتورز، الفرق، الفرص…',
                       'Search paths, mentors, teams, openings…')}
        aria-label={t('بحث', 'Search')}
      />
    </form>
  );
}
